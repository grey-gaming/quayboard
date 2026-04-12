import { describe, expect, it } from "vitest";

import { buildBudgetedFeatureDocSections } from "../../src/services/context-pack-service.js";

describe("context pack service helpers", () => {
  it("keeps approved feature docs whole and drops docs that do not fit", () => {
    const result = buildBudgetedFeatureDocSections({
      baseLoadedChars: 80,
      budgetChars: 180,
      approvedFeatureDocs: [
        {
          coverageKey: "feature-product-spec",
          label: "Approved Feature Product Spec",
          omissionKey: "feature-product-spec-over-budget",
          markdown: "short product doc",
        },
        {
          coverageKey: "feature-tech-spec",
          label: "Approved Feature Tech Spec",
          omissionKey: "feature-tech-spec-over-budget",
          markdown: "x".repeat(200),
        },
        {
          coverageKey: "feature-ux-spec",
          label: "Approved Feature UX Spec",
          omissionKey: "feature-ux-spec-over-budget",
          markdown: "short ux doc",
        },
      ],
    });

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0]).toContain("short product doc");
    expect(result.sections.join("\n")).not.toContain("x".repeat(200));
    expect(result.sections[1]).toContain("short ux doc");
    expect(result.sourceCoverage).toEqual(["feature-product-spec", "feature-ux-spec"]);
    expect(result.omissionList).toEqual(["feature-tech-spec-over-budget"]);
  });
});
