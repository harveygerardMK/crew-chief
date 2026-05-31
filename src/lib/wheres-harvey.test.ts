import { describe, expect, it } from "vitest";
import {
  getLastAidStation,
  getNextAidStation,
  pickArtPairing,
  racePhaseBand,
} from "./wheres-harvey";

describe("getLastAidStation", () => {
  it("returns last passed aid", () => {
    expect(getLastAidStation(55)?.name).toBe("Sierra at Tahoe");
    expect(getLastAidStation(10)?.name).toBe("Heavenly");
  });

  it("returns null before first real stop", () => {
    expect(getLastAidStation(0)).toBeNull();
  });
});

describe("racePhaseBand", () => {
  it("bands miles correctly", () => {
    expect(racePhaseBand(10)).toBe("early");
    expect(racePhaseBand(70)).toBe("mid");
    expect(racePhaseBand(130)).toBe("deep");
    expect(racePhaseBand(190)).toBe("finish");
  });
});

describe("pickArtPairing", () => {
  const base = {
    hour: 14,
    elapsedHours: 30,
    weather: "clear" as const,
    paceBucket: "cruising" as const,
    mile: 62,
    lastAid: getLastAidStation(62),
    nextAid: getNextAidStation(62),
    nextAidIsCrew: true,
    segmentName: "Sierra at Tahoe → Wrights Lake",
    phaseBand: racePhaseBand(62),
  };

  it("returns artwork fields", () => {
    const art = pickArtPairing(base);
    expect(art.title.length).toBeGreaterThan(0);
    expect(art.artist.length).toBeGreaterThan(0);
    expect(art.imageUrl).toMatch(/^https:\/\/api\.nga\.gov\/iiif\//);
    expect(art.sourceUrl).toMatch(/nga\.gov/);
    expect(art.sportsMoment).toContain("Harvey");
    expect(art.caption.length).toBeGreaterThan(0);
  });

  it("is stable for the same context", () => {
    const a = pickArtPairing(base);
    const b = pickArtPairing(base);
    expect(a.title).toBe(b.title);
  });

  it("skips already-shown works when excludeObjectIds is set", () => {
    const first = pickArtPairing(base);
    expect(first.objectId.length).toBeGreaterThan(0);
    const again = pickArtPairing(base, { excludeObjectIds: new Set([first.objectId]) });
    expect(again.objectId).not.toBe(first.objectId);
  });

  it("changes when next aid changes", () => {
    const nearSierra = pickArtPairing({ ...base, mile: 52, phaseBand: "mid" });
    const nearWrights = pickArtPairing({ ...base, mile: 71, phaseBand: "mid" });
    expect(nearSierra.sportsMoment).not.toEqual(nearWrights.sportsMoment);
  });
});
