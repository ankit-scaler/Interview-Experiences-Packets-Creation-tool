import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPublishedPacket } from "@/lib/packets";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReadTracker } from "@/components/read-tracker";
import { FeedbackFab } from "@/components/feedback-fab";
import { VaultBar } from "@/components/vault-button";
import { LearnerMenu } from "@/components/learner-menu";
import { ScalerLogo } from "@/components/scaler-logo";

export const dynamic = "force-dynamic";

export default async function LearnerPacketPage({ params }: { params: { slug: string } }) {
  const user = await currentUser();
  if (!user) redirect(`/signin?callbackUrl=/p/${params.slug}`);

  const exists = await db.packet.findUnique({
    where: { slug: params.slug },
    select: { status: true, company: true, role: true },
  });
  if (!exists) notFound();

  if (exists.status !== "PUBLISHED") {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <div className="rounded-2xl border border-border bg-card elev px-6 py-10">
            <h1 className="text-lg font-semibold">This packet isn&apos;t ready yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The {exists.company} — {exists.role} packet is still being prepared. Check back
              soon.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  const packet = await getPublishedPacket(params.slug);
  if (!packet) notFound();

  const existingFeedback = user.email
    ? await db.feedback.findUnique({
        where: { packetId_userEmail: { packetId: packet.id, userEmail: user.email } },
      })
    : null;

  return (
    <Shell email={user.email} slug={params.slug}>
      <ReadTracker slug={params.slug} />
      <div className="mx-auto max-w-3xl py-6 sm:py-10">
        <article className="overflow-hidden rounded-2xl border border-border bg-card elev">
          <header className="border-b border-border px-5 py-6 sm:px-9 sm:py-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Interview packet
            </p>
            <h1 className="mt-1.5 text-balance text-xl font-bold leading-tight tracking-tight sm:text-[26px]">
              {packet.company} — {packet.role}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Round-wise questions from interviews that already happened.
            </p>
          </header>

          <div className="divide-y divide-border">
            {packet.rounds.map((round, ri) => (
              <section key={round.id} className="scroll-mt-20 px-5 py-6 sm:px-9 sm:py-8">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {round.isSpillover ? "＋" : ri + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-tight sm:text-lg">
                      {round.name}
                    </h2>
                    {round.duration && (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {round.duration}
                      </p>
                    )}
                  </div>
                </div>
                <ol className="space-y-1">
                  {round.questions.map((q, i) => (
                    <li
                      key={q.id}
                      className="group flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60 sm:gap-4 sm:px-3"
                    >
                      <span className="select-none pt-[3px] text-sm font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-pretty text-[15px] leading-7 sm:text-base">
                          {q.displayText}
                        </p>
                        {q.problemLink && (
                          <a
                            href={q.problemLink}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Solve this question
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </article>
      </div>

      <FeedbackFab
        slug={params.slug}
        initial={
          existingFeedback
            ? {
                stars: existingFeedback.stars,
                matched: existingFeedback.matched,
                comment: existingFeedback.comment ?? "",
              }
            : null
        }
      />
    </Shell>
  );
}

function Shell({
  children,
  email,
  slug,
}: {
  children: React.ReactNode;
  email?: string | null;
  slug?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <ScalerLogo className="h-5 sm:h-[22px]" />
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {email ? <LearnerMenu email={email} /> : null}
          </div>
        </div>
        {slug ? <VaultBar slug={slug} /> : null}
      </header>
      <div className="flex-1 px-4">{children}</div>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-3xl px-4 py-6 text-xs text-muted-foreground">
          Beta — email{" "}
          <Link href={`mailto:${env.contactEmail}`} className="font-medium text-foreground underline underline-offset-2">
            {env.contactEmail}
          </Link>{" "}
          for issues.
        </p>
      </footer>
    </div>
  );
}
