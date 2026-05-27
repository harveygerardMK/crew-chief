import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

describe("session", () => {
  it("round-trips a valid token", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const token = await signSession(secret, 60);
    const payload = await verifySession(secret, token);
    expect(payload).not.toBeNull();
  });

  it("rejects tampered token", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const token = `${await signSession(secret, 60)}x`;
    expect(await verifySession(secret, token)).toBeNull();
  });
});
