const markdownModules = import.meta.glob("../../../../docs/user/*.md", {
  eager: true,
  import: "default",
  query: "?raw",
});

export type DocsEntry = {
  markdown: string;
  slug: string;
  summary: string | null;
  title: string;
};

const humanizeSlug = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const extractHeading = (markdown: string) =>
  markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim() ?? null;

const extractSummary = (markdown: string) =>
  markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#")) ?? null;

const docsEntries = Object.entries(markdownModules)
  .map(([path, markdown]) => {
    const fileName = path.split("/").pop()?.replace(/\.md$/, "") ?? "guide";
    const slug = fileName === "README" ? "" : fileName.toLowerCase();
    const content = String(markdown);

    return {
      slug,
      markdown: content,
      title: extractHeading(content) ?? (slug ? humanizeSlug(slug) : "User Documentation"),
      summary: extractSummary(content),
    } satisfies DocsEntry;
  })
  .sort((left, right) => {
    if (!left.slug) {
      return -1;
    }

    if (!right.slug) {
      return 1;
    }

    return left.title.localeCompare(right.title);
  });

export const docsLandingEntry = docsEntries.find((entry) => entry.slug === "") ?? {
  slug: "",
  markdown: "# User Documentation",
  title: "User Documentation",
  summary: null,
};

export const docsGuideEntries = docsEntries.filter((entry) => entry.slug !== "");

export const getDocsEntry = (slug: string) =>
  docsEntries.find((entry) => entry.slug === slug) ?? null;
