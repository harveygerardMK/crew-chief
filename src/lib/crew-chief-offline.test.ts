import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("Crew Chief shutdown", () => {
  it("does not run scheduled or automatic live agent checks", () => {
    const healthWorkflow = read(".github/workflows/agent-health.yml");
    const dropletWorkflow = read(".github/workflows/agent-droplet-deploy.yml");
    const pagesWorkflow = read(".github/workflows/deploy.yml");

    expect(healthWorkflow).not.toContain("schedule:");
    expect(healthWorkflow).not.toContain("verify-agent.sh");
    expect(dropletWorkflow).not.toContain("push:");
    expect(dropletWorkflow).not.toContain("verify-agent.sh");
    expect(pagesWorkflow).not.toContain("verify-agent.sh");
    expect(pagesWorkflow).toContain('PUBLIC_AGENT_API_URL: ""');
  });

  it("renders a race-over state instead of calling an unconfigured API", () => {
    const app = read("ui/app.js");

    expect(app).toContain("function showCrewChiefOffline()");
    expect(app).toContain("Race complete");
    expect(app).toMatch(
      /function showCrewChiefOffline\(\) \{[\s\S]*\$\("welcome-overlay"\)\?\.classList\.add\("hidden"\);/,
    );
    expect(app).toContain("showCrewChiefOffline();");
  });
});
