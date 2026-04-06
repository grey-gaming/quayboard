import { describe, expect, it } from "vitest";

import {
  isProjectReviewHighOnlyPhase,
  partitionProjectReviewFindings,
} from "../../src/services/project-review-service.js";

describe("project review service helpers", () => {
  it("switches to high-only mode only when two or fewer fix passes remain", () => {
    expect(isProjectReviewHighOnlyPhase(0, 5)).toBe(false);
    expect(isProjectReviewHighOnlyPhase(2, 5)).toBe(false);
    expect(isProjectReviewHighOnlyPhase(3, 5)).toBe(true);
    expect(isProjectReviewHighOnlyPhase(4, 5)).toBe(true);
  });

  it("treats only critical and high findings as blocking in the final phase", () => {
    const findings = [
      { severity: "critical" as const, finding: "critical issue" },
      { severity: "high" as const, finding: "high issue" },
      { severity: "medium" as const, finding: "medium issue" },
      { severity: "low" as const, finding: "low issue" },
    ];

    expect(partitionProjectReviewFindings(findings, false)).toEqual({
      blocking: findings,
      ignored: [],
    });

    expect(partitionProjectReviewFindings(findings, true)).toEqual({
      blocking: [
        { severity: "critical", finding: "critical issue" },
        { severity: "high", finding: "high issue" },
      ],
      ignored: [
        { severity: "medium", finding: "medium issue" },
        { severity: "low", finding: "low issue" },
      ],
    });
  });
});
