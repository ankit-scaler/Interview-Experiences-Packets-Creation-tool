import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPublishedPacket } from "@/lib/packets";
import { ThemeToggle } from "@/components/theme-toggle";
import { ReadTracker } from "@/components/read-tracker";
import { FeedbackFab } from "@/components/feedback-fab";
import { VaultCard } from "@/components/vault-button";
import { PacketReader } from "@/components/packet-reader";
import { AddOnsCard } from "@/components/addons-card";
import { LearnerMenu } from "@/components/learner-menu";
import { ScalerLogo } from "@/components/scaler-logo";

export const dynamic = "force-dynamic";

const YOE_LABEL: Record<string, string> = { LT2: "< 2 yrs", B2_5: "2–5 yrs", GT5: "5+ yrs" };

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

  // Empty rounds aren't shown and don't count toward reading progress.
  const rounds = packet.rounds
    .filter((r) => r.questions.length > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      duration: r.duration,
      isSpillover: r.isSpillover,
      questions: r.questions,
    }));
  const questionCount = rounds.reduce((n, r) => n + r.questions.length, 0);

  return (
    <Shell email={user.email}>
      <ReadTracker slug={params.slug} totalRounds={rounds.length} />
      <div className="mx-auto max-w-[1040px] pb-12 pt-5 sm:pt-7">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warning">Interview packet</p>
          <h1 className="mt-2 text-balance text-[26px] font-bold leading-tight tracking-tight sm:text-[36px]">
            {packet.company} — {packet.role}
          </h1>
          <p className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-muted-foreground">
            <span>{rounds.length} {rounds.length === 1 ? "round" : "rounds"}</span>
            <span>{questionCount} {questionCount === 1 ? "question" : "questions"}</span>
            <span>
              {packet.role} · {YOE_LABEL[packet.yoeBucket] ?? packet.yoeBucket}
            </span>
          </p>
        </header>

        {packet.addOns?.trim() && (
          <div className="mt-5 sm:mt-6">
            <AddOnsCard markdown={packet.addOns} />
          </div>
        )}

        <div className="mt-5 sm:mt-6">
          <VaultCard slug={params.slug} />
        </div>

        <div className="mt-5 sm:mt-6">
          {rounds.length ? (
            <PacketReader rounds={rounds} />
          ) : (
            <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              No questions in this packet yet.
            </p>
          )}
        </div>
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

/** `learner` scopes the teal reading palette (globals.css) to this page. */
function Shell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  return (
    <div className="learner flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="flex h-[55px] items-center gap-2 px-4 sm:px-6">
          <ScalerLogo className="h-5 sm:h-[22px]" />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle label />
            {email ? <LearnerMenu email={email} /> : null}
          </div>
        </div>
      </header>
      <div className="flex-1 px-4">{children}</div>
      <footer className="border-t border-border">
        <p className="mx-auto max-w-[1040px] px-4 py-6 text-xs text-muted-foreground">
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
