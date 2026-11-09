import { describe, expect, it } from "vitest";
import { joinTopic, splitTopic } from "@/lib/topic";

describe("splitTopic / joinTopic", () => {
  it("splits a leading [Topic] prefix", () => {
    expect(splitTopic("[Kafka] How do consumer groups rebalance?")).toEqual({
      topic: "Kafka",
      body: "How do consumer groups rebalance?",
    });
  });

  it("leaves text without a prefix alone", () => {
    expect(splitTopic("Reverse a linked list")).toEqual({
      topic: null,
      body: "Reverse a linked list",
    });
  });

  it("ignores brackets that are not a leading prefix", () => {
    expect(splitTopic("Explain arr[i] access").topic).toBeNull();
    expect(splitTopic("[Kafka]").topic).toBeNull();
  });

  it("round-trips", () => {
    const t = "[Spring Boot] What is auto-configuration?";
    const { topic, body } = splitTopic(t);
    expect(joinTopic(topic, body)).toBe(t);
  });
});
