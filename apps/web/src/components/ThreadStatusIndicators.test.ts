import { describe, expect, it } from "vitest";

import { ciStatusIndicator } from "./ThreadStatusIndicators";

describe("ciStatusIndicator", () => {
  it("returns a failing GitHub Actions indicator", () => {
    expect(
      ciStatusIndicator({
        status: "failing",
        totalCount: 2,
        passCount: 1,
        failCount: 1,
        pendingCount: 0,
        skippingCount: 0,
        cancelCount: 0,
        checks: [],
      }),
    ).toMatchObject({
      label: "GitHub Actions failing",
      colorClass: "text-destructive",
    });
  });

  it("hides unknown and empty check summaries", () => {
    expect(ciStatusIndicator(null)).toBeNull();
    expect(
      ciStatusIndicator({
        status: "unknown",
        totalCount: 0,
        passCount: 0,
        failCount: 0,
        pendingCount: 0,
        skippingCount: 0,
        cancelCount: 0,
        checks: [],
      }),
    ).toBeNull();
  });
});
