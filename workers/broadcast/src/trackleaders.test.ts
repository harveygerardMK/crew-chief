import { afterEach, describe, expect, it, vi } from "vitest";
import { getTrackerSnapshot, parseTrackLeadersTime, resetTrackerCacheForTests } from "./trackleaders";

afterEach(() => {
  resetTrackerCacheForTests();
  vi.unstubAllGlobals();
});

describe("parseTrackLeadersTime", () => {
  it("parses AKST timestamp", () => {
    const d = parseTrackLeadersTime("05:02:05 PM (AKST) 01/12/26");
    expect(d).not.toBeNull();
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it("returns null for garbage", () => {
    expect(parseTrackLeadersTime("soon")).toBeNull();
  });
});

describe("getTrackerSnapshot", () => {
  it("returns disabled when env is empty", async () => {
    const s = await getTrackerSnapshot({});
    expect(s.enabled).toBe(false);
  });

  it("parses TrackLeaders status JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            ["Race Status", "Active"],
            ["Last Update Rec'd", "05:02:05 PM (AKST) 01/12/26"],
            ["Route mile", "281.7 mi"],
            ["Elevation Gain", "10840 ft"],
            ["Current speed", "0.0 mph"],
          ],
        }),
      }),
    );

    const s = await getTrackerSnapshot({
      TRACKLEADERS_EVENT_SLUG: "copper26",
      TRACKLEADERS_RUNNER_NAME: "Trailbreaker_1",
    });

    expect(s.enabled).toBe(true);
    expect(s.route_mile).toBe(281.7);
    expect(s.elevation_gain_ft).toBe(10840);
    expect(s.current_speed_mph).toBe(0);
    expect(s.race_status).toBe("active");
  });
});
