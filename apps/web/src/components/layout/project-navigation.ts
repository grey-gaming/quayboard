import type { Project } from "@quayboard/shared";

import { isSetupCompletedProjectState } from "../../lib/project-state.js";

export type ProjectNavSection =
  | "mission-control"
  | "setup"
  | "product-design"
  | "feature-design"
  | "implementation";

export type ProjectTertiaryNavItem =
  | {
      kind: "button";
      key: string;
      label: string;
      active: boolean;
      onClick: () => void;
      disabled?: boolean;
    }
  | {
      kind: "disabled";
      key: string;
      label: string;
      title?: string;
    }
  | {
      kind: "label";
      key: string;
      label: string;
      title?: string;
      truncate?: boolean;
    }
  | {
      kind: "link";
      key: string;
      label: string;
      to: string;
      disabled?: boolean;
      end?: boolean;
      title?: string;
    };

const lockedTitle = "Complete setup to unlock this section.";

export const getSetupCompletion = (project: Project) => isSetupCompletedProjectState(project.state);

export const buildSetupTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => {
  const setupCompleted = getSetupCompletion(project);

  return [
    {
      kind: "link",
      key: "project-setup",
      label: "Project Setup",
      to: `/projects/${project.id}/setup`,
      end: true,
    },
    setupCompleted
      ? {
          kind: "link",
          key: "questions",
          label: "Questions",
          to: `/projects/${project.id}/questions`,
          end: true,
        }
      : {
          kind: "disabled",
          key: "questions",
          label: "Questions",
          title: lockedTitle,
        },
    setupCompleted
      ? {
          kind: "link",
          key: "import",
          label: "Import",
          to: `/projects/${project.id}/import`,
          end: true,
        }
      : {
          kind: "disabled",
          key: "import",
          label: "Import",
          title: lockedTitle,
        },
  ];
};

export const buildProductDesignTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => {
  const setupCompleted = getSetupCompletion(project);

  if (!setupCompleted) {
    return [
      "Overview",
      "Product Spec",
      "UX Spec",
      "Technical Spec",
      "User Flows",
      "Milestones",
    ].map((label) => ({
      kind: "disabled" as const,
      key: label.toLowerCase().replaceAll(" ", "-"),
      label,
      title: lockedTitle,
    }));
  }

  return [
    {
      kind: "link",
      key: "overview",
      label: "Overview",
      to: `/projects/${project.id}/one-pager`,
      end: true,
    },
    {
      kind: "link",
      key: "product-spec",
      label: "Product Spec",
      to: `/projects/${project.id}/product-spec`,
      end: true,
    },
    {
      kind: "link",
      key: "ux-spec",
      label: "UX Spec",
      to: `/projects/${project.id}/ux-spec`,
      end: true,
    },
    {
      kind: "link",
      key: "technical-spec",
      label: "Technical Spec",
      to: `/projects/${project.id}/technical-spec`,
      end: true,
    },
    {
      kind: "link",
      key: "user-flows",
      label: "User Flows",
      to: `/projects/${project.id}/user-flows`,
      end: true,
    },
    {
      kind: "link",
      key: "milestones",
      label: "Milestones",
      to: `/projects/${project.id}/milestones`,
      end: true,
    },
  ];
};

export const buildFeatureBuilderTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => [
  {
    kind: "link",
    key: "feature-builder",
    label: "Feature Builder",
    to: `/projects/${project.id}/features`,
    end: true,
  },
];
