import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "../src/app.js";

describe("App", () => {
  it("renders the foundation headline", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("Repository and Toolchain Foundations");
  });
});
