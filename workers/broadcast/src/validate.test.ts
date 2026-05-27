import { describe, expect, it } from "vitest";
import { prepareBroadcastFields, validateBroadcastFields } from "./validate";

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

  it("fills time when station set but time missing", () => {
    const prepared = prepareBroadcastFields({
      doing: "",
      station: "Sierra at Tahoe",
      timeLabel: "",
      note: "",
    });
    expect(prepared.timeLabel.length).toBeGreaterThan(0);
    expect(validateBroadcastFields(prepared).ok).toBe(true);
  });

  it("ignores __other__ without a custom station name", () => {
    const prepared = prepareBroadcastFields({
      doing: "On the move",
      station: "__other__",
      timeLabel: "",
      note: "",
    });
    expect(prepared.station).toBe("");
    expect(validateBroadcastFields(prepared).ok).toBe(true);
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
