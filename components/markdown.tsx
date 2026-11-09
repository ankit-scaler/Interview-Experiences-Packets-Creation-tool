import ReactMarkdown from "react-markdown";

/** Safe markdown: raw HTML is not rendered; links open in a new tab. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-2 text-[15px] leading-6 [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc">
      <ReactMarkdown
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
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
