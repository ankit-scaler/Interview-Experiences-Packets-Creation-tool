import type { QuestionSource, Track, YoeBucket } from "@prisma/client";

/** One question row from the repo sheet, after header mapping. */
export interface RepoRow {
  rowIndex: number;
  tab: string;
  company: string;
  role: string;
  round: string;
  status: string;
  isRelevant: boolean;
  question: string;
  solution: string;
  relatedModule: string;
  relatedTopic: string;
  dateAdded: string; // raw sheet value
  dateAddedTs: number | null; // parsed epoch ms, or null
  jobId: string;
  userId: string;
  email: string;
}

export interface PacketContext {
  company: string;
  role: string;
  stack: string;
  track: Track;
  yoeBucket: YoeBucket;
  location: string;
  /** Human level label for prompts, e.g. "2 – 5 years". */
  level: string;
  jdText: string;
  /** Source ids the admin enabled for this packet; empty = all approved sources. */
  webSources: string[];
}

export interface DraftQuestion {
  text: string;
  originalText: string;
  source: QuestionSource;
  problemLink?: string | null;
  problemLinkSource?: "LEETCODE" | "GFG" | "MANUAL" | null;
  normalizedText: string;
  sheetRef?: Record<string, unknown> | null;
  /** How many source rows (candidates) asked essentially this question. */
  occurrences: number;
  /** Most recent Date-Added among those rows (epoch ms), or null. */
  latestTs: number | null;
}

export interface DraftRound {
  /** Stable key, e.g. "r1", "hr", "system-design". */
  key: string;
  /** Best round label so far (sheet value or inferred). */
  name: string;
  duration?: string | null;
  isSpillover?: boolean;
  questions: DraftQuestion[];
}
