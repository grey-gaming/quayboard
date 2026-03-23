export type MarkdownHeading = {
  id: string;
  level: 2 | 3;
  title: string;
};

const slugifyHeading = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/&[a-z]+;/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "section";
};

const stripHeadingMarkdown = (value: string) =>
  value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

export const buildHeadingId = (
  title: string,
  counts: Map<string, number>,
) => {
  const baseId = slugifyHeading(stripHeadingMarkdown(title));
  const nextCount = (counts.get(baseId) ?? 0) + 1;
  counts.set(baseId, nextCount);

  return nextCount === 1 ? baseId : `${baseId}-${nextCount}`;
};

export const extractMarkdownHeadings = (markdown: string): MarkdownHeading[] => {
  const headings: MarkdownHeading[] = [];
  const counts = new Map<string, number>();
  let inFence = false;

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{2,3})\s+(.+)$/.exec(trimmed);

    if (!match) {
      continue;
    }

    const level = match[1].length;

    if (level !== 2 && level !== 3) {
      continue;
    }

    const title = stripHeadingMarkdown(match[2]);

    if (!title) {
      continue;
    }

    headings.push({
      id: buildHeadingId(title, counts),
      level,
      title,
    });
  }

  return headings;
};
