import { hasLlm, hasGoogleSheets } from "@/lib/env";
import { CreateForm } from "@/components/create-form";

export const dynamic = "force-dynamic";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Create a packet</h1>
        <p className="text-sm text-muted-foreground">
          Pick the company, role and experience band. The tool pulls matching questions,
          improves readability, and lays them out round-wise for you to review.
        </p>
      </div>
      <CreateForm llmReady={hasLlm()} sheetsReady={hasGoogleSheets()} />
    </div>
  );
}
