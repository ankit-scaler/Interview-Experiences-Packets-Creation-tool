import type { AdminAction, Track, YoeBucket } from "@prisma/client";

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

// Lives here rather than in lib/activity.ts so the client activity log can
// import it without dragging the Prisma client into the browser bundle.
export const ACTION_LABEL: Record<AdminAction, string> = {
  PACKET_CREATED: "Created packet",
  PACKET_EDITED: "Edited packet",
  PACKET_DELETED: "Deleted packet",
  PACKET_PUBLISHED: "Published",
  PACKET_UNPUBLISHED: "Unpublished",
  GENERATION_STARTED: "Started generation",
  REGENERATION_STARTED: "Pulled new questions",
  ROUND_ADDED: "Added round",
  ROUND_EDITED: "Edited round",
  ROUND_DELETED: "Deleted round",
  QUESTION_ADDED: "Added question",
  QUESTION_EDITED: "Edited question",
  QUESTION_DELETED: "Removed question",
};
