import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownDocument } from "../src/components/composites/MarkdownDocument.js";

afterEach(() => {
  cleanup();
});

describe("MarkdownDocument", () => {
  it("renders a table of contents with stable heading anchors", () => {
    render(
      <MemoryRouter>
        <MarkdownDocument
          markdown={[
            "# Spec",
            "",
            "## Overview",
            "",
            "Body copy.",
            "",
            "### Details",
            "",
            "Nested section.",
            "",
            "## Overview",
            "",
            "Second section.",
          ].join("\n")}
          showTableOfContents
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "On this page" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Overview" })[0].getAttribute("href")).toBe(
      "#overview",
    );
    expect(screen.getByRole("link", { name: "Details" }).getAttribute("href")).toBe("#details");
    expect(screen.getAllByRole("heading", { name: "Overview" })[0].getAttribute("id")).toBe(
      "overview",
    );
    expect(screen.getByRole("heading", { name: "Details" }).getAttribute("id")).toBe("details");
    expect(screen.getAllByRole("heading", { name: "Overview" })[1].getAttribute("id")).toBe(
      "overview-2",
    );
  });

  it("does not render a table of contents when fewer than two eligible headings exist", () => {
    render(
      <MemoryRouter>
        <MarkdownDocument markdown={"# Short Doc\n\n## Single Section\n\nOnly one section."} showTableOfContents />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "On This Page" })).toBeNull();
  });

  it("applies stronger list indentation for ordered and unordered lists", () => {
    render(
      <MemoryRouter>
        <MarkdownDocument
          markdown={[
            "## Checklist",
            "",
            "- First item",
            "  - Nested item",
            "1. Ordered item",
          ].join("\n")}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("list")[0].className).toContain("ml-7");
    expect(screen.getAllByRole("list")[0].className).toContain("pl-4");
    expect(screen.getAllByRole("list")[1].className).toContain("ml-7");
    expect(screen.getAllByRole("list")[2].className).toContain("list-decimal");
    expect(screen.getAllByRole("listitem")[0].className).toContain("pl-1");
  });
});
