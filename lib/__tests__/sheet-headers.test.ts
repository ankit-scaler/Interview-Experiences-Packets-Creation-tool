import { describe, expect, it } from "vitest";
import { resolveColumns } from "@/lib/sheets/repo";

describe("resolveColumns", () => {
  it("maps the Academy header variant", () => {
    const header = [
      "Job ID", "User ID", "Name", "Email", "Contact", "Program", "Company", "Role",
      "Round", "Status", "Date Added", "Date of Call", "Is Question Relevant",
      "Question (including Followups)", "Solutions", "Related Module",
    ];
    const cols = resolveColumns(header);
    expect(cols.company).toBe(6);
    expect(cols.role).toBe(7);
    expect(cols.round).toBe(8);
    expect(cols.status).toBe(9);
    expect(cols.isRelevant).toBe(12);
    expect(cols.question).toBe(13);
  });

  it("maps the DevOps/DSML header variant", () => {
    const header = [
      "Job ID", "User ID", "Name", "Email", "Contact", "Program", "Company", "Role",
      "# Round - Name", "Final Status", "Date Added", "Date of Call", "Is Question Relevant",
      "Question (including Followups)", "Solution Given by Learner", "Related Module",
    ];
    const cols = resolveColumns(header);
    expect(cols.round).toBe(8);
    expect(cols.status).toBe(9);
    expect(cols.question).toBe(13);
    expect(cols.solution).toBe(14);
  });
});
