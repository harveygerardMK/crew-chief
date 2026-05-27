import { describe, expect, it } from "vitest";
import { validateBroadcastFields } from "./validate";

describe("validateBroadcastFields", () => {
  it("rejects empty doing and station", () => {
    const r = validateBroadcastFields({ doing: "", station: "", timeLabel: "Now", note: "" });
    expect(r.ok).toBe(false);
  });

  it("accepts doing only", () => {
    const r = validateBroadcastFields({
      doing: "Moving well",
      station: "",
      timeLabel: "Sat 1 PM PDT",
      note: "",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects doing over 200 chars", () => {
    const r = validateBroadcastFields({
      doing: "x".repeat(201),
      station: "Tahoe City",
      timeLabel: "Now",
      note: "",
    });
    expect(r.ok).toBe(false);
  });
});
