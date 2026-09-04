import OpenAI from "openai";
import type { LlmPurpose } from "@prisma/client";
import { env, hasLlm } from "@/lib/env";
import { recordLlmCall } from "./usage";
import type { TokenUsage } from "./pricing";

/**
 * All model calls go through OpenRouter, which exposes an OpenAI-compatible
 * `/chat/completions` endpoint (there is no Anthropic-native `/v1/messages`).
 * Web search is an OpenRouter *plugin* rather than an Anthropic server tool.
 */

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!hasLlm()) throw new LlmDisabledError();
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.openRouterApiKey,
      baseURL: env.openRouterBaseUrl,
      defaultHeaders: {
        // Optional OpenRouter attribution headers.
        "HTTP-Referer": env.appUrl,
        "X-Title": "Scaler Interview Packets",
      },
    });
  }
  return _client;
}

export class LlmDisabledError extends Error {
  constructor() {
    super("OPENROUTER_API_KEY is not set — LLM features are unavailable.");
    this.name = "LlmDisabledError";
  }
}

/** OpenRouter web-search plugin config (domain-restricted). */
export interface WebPlugin {
  id: "web";
  include_domains?: string[];
  max_results?: number;
  engine?: "native" | "exa" | "parallel" | "perplexity";
}

export interface CompleteOptions {
  purpose: LlmPurpose;
  model: string;
  system?: string;
  /** Stable prefix sent as a cached system block (prompt caching). */
  cachedSystem?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  /** Enables domain-restricted web search for this call. */
  web?: WebPlugin;
  jobId?: string | null;
  packetId?: string | null;
}

export interface CompleteResult {
  text: string;
  usage: TokenUsage;
  costUsd: number;
}

/**
 * OpenRouter returns real billed usage on every response, including cached-token
 * detail and the actual dollar cost (which already includes web-search fees).
 */
function extractUsage(raw: unknown): TokenUsage {
  const u = (raw ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  };
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: u.prompt_tokens_details?.cache_write_tokens ?? 0,
    // Authoritative cost straight from OpenRouter; undefined falls back to our table.
    reportedCostUsd: typeof u.cost === "number" ? u.cost : undefined,
  };
}

/** One model call, with usage + cost booked to the job and packet. */
export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (opts.cachedSystem) {
    messages.push({
      role: "system",
      // Content parts let us mark the stable prefix as cacheable.
      content: [
        {
          type: "text",
          text: opts.cachedSystem,
          // OpenRouter passes cache_control through to Anthropic.
          cache_control: { type: "ephemeral" },
        },
      ] as unknown as OpenAI.Chat.ChatCompletionContentPartText[],
    });
  }
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt });

  // `plugins` is an OpenRouter extension, not part of the OpenAI schema.
  const body = {
    model: opts.model,
    messages,
    max_tokens: opts.maxTokens ?? 4096,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.web ? { plugins: [opts.web] } : {}),
  } as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

  const res = await client().chat.completions.create(body);

  const usage = extractUsage(res.usage);
  const cost = await recordLlmCall({
    purpose: opts.purpose,
    model: opts.model,
    usage,
    jobId: opts.jobId,
    packetId: opts.packetId,
  });

  return { text: (res.choices[0]?.message?.content ?? "").trim(), usage, costUsd: cost };
}

/** Parse the first JSON value (object or array) out of a model response. */
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("]"), candidate.lastIndexOf("}"));
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1)) as T;
    }
    throw new Error(`Model did not return valid JSON:\n${text.slice(0, 500)}`);
  }
}
