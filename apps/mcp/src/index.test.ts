import { describe, expect, it } from "vitest";

import { placeholderMessage } from "./index.js";

describe("placeholderMessage", () => {
  it("explains that MCP support is not implemented yet", () => {
    expect(placeholderMessage).toContain("M9");
  });
});
