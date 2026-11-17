import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { makeSlugger } from "@/lib/prep";
import { cn } from "@/lib/utils";

/** Plain text of a heading's rendered children (for its id). */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

/** Safe markdown: raw HTML is not rendered; links open in a new tab. */
export function Markdown({ source, large = false }: { source: string; large?: boolean }) {
  // Fresh per render so repeated headings get stable -2, -3 suffixes in document order.
  const slug = makeSlugger();
  return (
    <div
      className={cn(
        "[&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc",
        large ? "space-y-4 text-[17px] leading-[1.75]" : "space-y-2 text-[15px] leading-6",
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h3 id={slug(textOf(children))} data-h="1" className={cn("scroll-mt-20 font-bold", large ? "pt-3 text-2xl" : "text-base")}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 id={slug(textOf(children))} data-h="2" className={cn("scroll-mt-20 font-bold", large ? "pt-3 text-xl" : "text-base")}>{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 id={slug(textOf(children))} data-h="3" className={cn("scroll-mt-20 font-bold", large ? "pt-2 text-lg" : "text-sm")}>{children}</h4>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-[13px]">{children}</code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-t border-border px-3 py-2 align-top">{children}</td>,
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[13px] leading-5">{children}</pre>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              loading="lazy"
              className="h-auto max-w-full rounded-md"
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
