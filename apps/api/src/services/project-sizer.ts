import type { QuestionnaireAnswers } from "@quayboard/shared";

export type ProjectSizeTier = "small" | "medium" | "large";

export type ProjectSizeProfile = {
  tier: ProjectSizeTier;
  /** Guidance cap for the LLM — not a hard enforcement limit */
  featureBudgetPerMilestone: number;
  /** Tech stack extracted from questionnaire answers, or null if not detectable */
  techStackHint: string | null;
};

const SMALL_SIGNALS = [
  "simple",
  "small",
  "solo",
  "single",
  "utility",
  "tool",
  "script",
  "one person",
  "just me",
  "prototype",
  "poc",
  "proof of concept",
  "hobby",
  "side project",
  "minimal",
  "basic",
  "lightweight",
];

const LARGE_SIGNALS = [
  "platform",
  "marketplace",
  "enterprise",
  "multi-tenant",
  "multitenant",
  "saas",
  "ecosystem",
  "complex",
  "large",
  "big",
  "team of",
  "many teams",
  "multiple teams",
  "large team",
  "hundreds",
  "thousands",
];

const TECH_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\btypescript\b|\bts\b/i, label: "TypeScript" },
  { pattern: /\bjavascript\b|\bjs\b/i, label: "JavaScript" },
  { pattern: /\bpython\b/i, label: "Python" },
  { pattern: /\brust\b/i, label: "Rust" },
  { pattern: /\bgo\b|\bgolang\b/i, label: "Go" },
  { pattern: /\bruby\b/i, label: "Ruby" },
  { pattern: /\bjava\b/i, label: "Java" },
  { pattern: /\bc#\b|\bdotnet\b|\.net\b/i, label: "C#/.NET" },
  { pattern: /\bphp\b/i, label: "PHP" },
  { pattern: /\bswift\b/i, label: "Swift" },
  { pattern: /\bkotlin\b/i, label: "Kotlin" },
  { pattern: /\breact\b/i, label: "React" },
  { pattern: /\bvue\b/i, label: "Vue" },
  { pattern: /\bangular\b/i, label: "Angular" },
  { pattern: /\bsvelte\b/i, label: "Svelte" },
  { pattern: /\bnext\.?js\b/i, label: "Next.js" },
  { pattern: /\bnuxt\b/i, label: "Nuxt" },
  { pattern: /\bnode\.?js\b|\bnode\b/i, label: "Node.js" },
  { pattern: /\bfastify\b/i, label: "Fastify" },
  { pattern: /\bexpress\b/i, label: "Express" },
  { pattern: /\bdjango\b/i, label: "Django" },
  { pattern: /\bflask\b/i, label: "Flask" },
  { pattern: /\brails\b|\bruby on rails\b/i, label: "Rails" },
  { pattern: /\blaravel\b/i, label: "Laravel" },
  { pattern: /\bpostgres\b|\bpostgresql\b/i, label: "PostgreSQL" },
  { pattern: /\bmysql\b/i, label: "MySQL" },
  { pattern: /\bmongo\b|\bmongodb\b/i, label: "MongoDB" },
  { pattern: /\bsqlite\b/i, label: "SQLite" },
  { pattern: /\bredis\b/i, label: "Redis" },
  { pattern: /\bdocker\b/i, label: "Docker" },
];

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

function extractTechStackHint(answers: QuestionnaireAnswers["answers"]): string | null {
  // q13_tech_constraints is the primary source; also scan q9_platform_and_access and q11_constraints_and_requirements
  const techText = [
    answers.q13_tech_constraints,
    answers.q9_platform_and_access,
    answers.q11_constraints_and_requirements,
  ]
    .filter(Boolean)
    .join(" ");

  if (!techText.trim()) return null;

  const found: string[] = [];
  const seen = new Set<string>();

  for (const { pattern, label } of TECH_KEYWORDS) {
    if (pattern.test(techText) && !seen.has(label)) {
      found.push(label);
      seen.add(label);
    }
  }

  return found.length > 0 ? found.join(" / ") : null;
}

/**
 * Classify project size from questionnaire answers.
 *
 * Defaults to "medium" when signals are ambiguous — only classifies as "small"
 * when there are explicit, multiple signals of limited scope.
 */
export function classifyProjectSize(
  answers: QuestionnaireAnswers["answers"],
): ProjectSizeProfile {
  const combinedText = Object.values(answers).filter(Boolean).join(" ");

  // Weight signals from the most relevant questions more heavily
  const scopeText = [
    answers.q1_name_and_description ?? "",
    answers.q11_constraints_and_requirements ?? "",
    answers.q6_main_capabilities ?? "",
  ].join(" ");

  const smallScore = countSignals(combinedText, SMALL_SIGNALS);
  const largeScore = countSignals(combinedText, LARGE_SIGNALS);

  // Also check for explicit solo/single indicators in key fields
  const scopeSmallScore = countSignals(scopeText, SMALL_SIGNALS);

  let tier: ProjectSizeTier;

  if (largeScore >= 2) {
    // Clear large signals take priority
    tier = "large";
  } else if (smallScore >= 3 && scopeSmallScore >= 1 && largeScore === 0) {
    // Require multiple small signals including in scope-relevant questions,
    // and no large signals, to avoid misclassifying ambiguous projects
    tier = "small";
  } else {
    // Default to medium — safer than over-constraining
    tier = "medium";
  }

  const budgets: Record<ProjectSizeTier, number> = {
    small: 4,
    medium: 6,
    large: 9,
  };

  return {
    tier,
    featureBudgetPerMilestone: budgets[tier],
    techStackHint: extractTechStackHint(answers),
  };
}
