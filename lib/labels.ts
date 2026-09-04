import type { Track, YoeBucket } from "@prisma/client";

export const TRACK_LABEL: Record<Track, string> = {
  ACADEMY: "Academy",
  DEVOPS: "DevOps",
  AIML: "AI / ML",
  DSML: "DS / ML",
};

export const YOE_LABEL: Record<YoeBucket, string> = {
  LT2: "0 – 2 yrs",
  B2_5: "2 – 5 yrs",
  GT5: "5+ yrs",
};

export const MATCHED_LABEL: Record<"YES" | "PARTLY" | "NO", string> = {
  YES: "Matched",
  PARTLY: "Partly matched",
  NO: "Did not match",
};
