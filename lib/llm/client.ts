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
 * OpenRouter usage. `cost` is meant to be the actual billed amount, but it can
 * come back as 0 or missing on the chat response (it's finalised slightly later,
 * queryable via /generation). We only trust a POSITIVE reported cost; anything
 * else falls back to the local price-table estimate in pricing.ts.
 */
function extractUsage(raw: unknown): TokenUsage {
  const u = (raw ?? {}) as {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  };
  const reported = typeof u.cost === "number" && u.cost > 0 ? u.cost : undefined;
  return {
    inputTokens: u.prompt_tokens ?? 0,
    outputTokens: u.completion_tokens ?? 0,
    cachedInputTokens: u.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: u.prompt_tokens_details?.cache_write_tokens ?? 0,
    reportedCostUsd: reported,
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

  let res: OpenAI.Chat.ChatCompletion;
  try {
    res = await client().chat.completions.create(body);
  } catch (err) {
    throw asFriendlyLlmError(err, opts.model);
  }

  const usage = extractUsage(res.usage);
  // The chat response's cost is 0 until finalised; try /generation for the real
  // figure. costUsd() takes max(reported, token-estimate), so a still-0 answer
  // here just means the estimate is used as the floor.
  if (usage.reportedCostUsd === undefined && res.id) {
    usage.reportedCostUsd = await fetchGenerationCost(res.id);
  }
  const cost = await recordLlmCall({
    purpose: opts.purpose,
    model: opts.model,
    usage,
    jobId: opts.jobId,
    packetId: opts.packetId,
  });

  return { text: (res.choices[0]?.message?.content ?? "").trim(), usage, costUsd: cost };
}

/** Authoritative post-hoc cost for a completion, once OpenRouter has finalised it. */
async function fetchGenerationCost(genId: string): Promise<number | undefined> {
  const url = `${env.openRouterBaseUrl.replace(/\/$/, "")}/generation?id=${encodeURIComponent(genId)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, attempt === 0 ? 250 : 600));
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${env.openRouterApiKey}` },
      });
      if (!r.ok) continue;
      // eslint-disable-next-line no-await-in-loop
      const j = (await r.json()) as { data?: { total_cost?: number } };
      const c = j?.data?.total_cost;
      if (typeof c === "number" && c > 0) return c;
      // 0 here can mean "not finalised yet" — keep trying, then give up (the
      // token estimate covers it).
    } catch {
      /* retry */
    }
  }
  return undefined;
}

/** Turn an OpenRouter/OpenAI SDK error into a message an admin can act on. */
function asFriendlyLlmError(err: unknown, model: string): Error {
  const e = err as { status?: number; message?: string; error?: { message?: string } };
  const status = e?.status;
  const detail = e?.error?.message || e?.message || "";
  if (status === 402) {
    return new Error(
      "OpenRouter is out of credits (or the daily spend limit was hit). Add credit / raise the limit, then retry from the failed step.",
    );
  }
  if (status === 429) {
    return new Error("OpenRouter rate-limited this request. Wait a minute and retry from the failed step.");
  }
  if (status === 404 || /no (allowed )?providers|not a valid model/i.test(detail)) {
    return new Error(
      `Model "${model}" isn't available on your OpenRouter key. Enable it at openrouter.ai, or change LLM_MODEL / LLM_MODEL_CHEAP.`,
    );
  }
  if (status === 401) {
    return new Error("OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY.");
  }
  return new Error(`LLM call failed${status ? ` (${status})` : ""}: ${detail || String(err)}`);
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
