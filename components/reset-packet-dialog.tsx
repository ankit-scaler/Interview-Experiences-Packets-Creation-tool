"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { companyConfirmed } from "@/lib/sections";

/** Two-step confirmation: (1) read what is deleted, (2) type the company name. */
export function ResetPacketDialog({
  packetId,
  company,
  open,
  onClose,
  onDone,
}: {
  packetId: string;
  company: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [clearAddOns, setClearAddOns] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setClearAddOns(false);
      setTyped("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/packets/${packetId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmCompany: typed, clearAddOns }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Reset failed");
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-lg"
      >
        <h2 id="reset-title" className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Reset packet {step === 1 ? "(1 of 2)" : "(2 of 2)"}
        </h2>

        {step === 1 ? (
          <>
            <div className="space-y-2 text-sm">
              <p>This will permanently delete:</p>
              <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                <li>all rounds and questions, including your edits and the JD round</li>
                <li>the list of questions you deleted before</li>
              </ul>
              <p>It then regenerates the packet from scratch and sets it back to Draft.</p>
              <p className="text-muted-foreground">
                Kept: the packet, its link, the JD, learner read stats and feedback.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={clearAddOns}
                onChange={(e) => setClearAddOns(e.target.checked)}
              />
              Also clear Interview Companion Add-Ons
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => setStep(2)}>
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm">
              Type <strong>{company}</strong> to confirm.
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={company}
              autoFocus
              aria-label="Type the company name to confirm"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                variant="destructive"
                loading={busy}
                disabled={busy || !companyConfirmed(typed, company)}
                onClick={submit}
              >
                Reset packet
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
