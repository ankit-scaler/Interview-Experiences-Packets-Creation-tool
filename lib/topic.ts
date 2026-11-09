/**
 * JD-spillover questions are stored as "[Topic] question text". These helpers
 * split that prefix off for display (as a flag) and put it back when saving.
 */
const TOPIC_RE = /^\[([^\]\n]{1,60})\]\s+([\s\S]+)$/;

export function splitTopic(text: string): { topic: string | null; body: string } {
  const m = text.match(TOPIC_RE);
  return m ? { topic: m[1].trim(), body: m[2].trim() } : { topic: null, body: text };
}

export function joinTopic(topic: string | null, body: string): string {
  return topic ? `[${topic}] ${body}` : body;
}
