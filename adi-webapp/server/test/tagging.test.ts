import { describe, expect, it } from "vitest";
import { buildSmartTags } from "../src/services/tagging-service";

describe("buildSmartTags", () => {
  it("builds source/date/batch tags and normalizes custom tags", () => {
    const tags = buildSmartTags({
      source: "chatgpt",
      jobId: "ABCDEF123456",
      customTags: [" Project Alpha ", "imported-chatgpt", "Release!"],
      now: new Date("2026-03-05T10:00:00Z"),
    });

    expect(tags).toEqual([
      "batch-abcdef12",
      "imported-2026-03",
      "imported-chatgpt",
      "project-alpha",
      "release",
    ]);
  });

  it("supports disabling optional date and batch tags", () => {
    const tags = buildSmartTags({
      source: "claude",
      jobId: "job-12345678",
      customTags: ["Team Sync"],
      includeDateTag: false,
      includeBatchTag: false,
    });

    expect(tags).toEqual(["imported-claude", "team-sync"]);
  });
});
