import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe markdown: raw HTML is not rendered; links open in a new tab. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-2 text-[15px] leading-6 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
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
          h1: ({ children }) => <h3 className="text-base font-bold">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-bold">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-bold">{children}</h4>,
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
