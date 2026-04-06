import type { Project } from "@quayboard/shared";

import { isSetupCompletedProjectState } from "../../lib/project-state.js";

export type ProjectNavSection =
  | "mission-control"
  | "settings"
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

export const buildSettingsTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => {
  const setupCompleted = getSetupCompletion(project);

  return [
    {
      kind: "link",
      key: "project-settings",
      label: "Project Settings",
      to: `/projects/${project.id}/settings`,
      end: true,
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
    {
      kind: "link",
      key: "delete-project",
      label: "Delete Project",
      to: `/projects/${project.id}/settings/delete`,
      end: true,
    },
  ];
};

export const buildProductDesignTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => {
  const setupCompleted = getSetupCompletion(project);

  if (!setupCompleted) {
    return [
      "Questions",
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
      key: "questions",
      label: "Questions",
      to: `/projects/${project.id}/questions`,
      end: true,
    },
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

export const buildImplementationTertiaryItems = (
  project: Project,
): ProjectTertiaryNavItem[] => [
  {
    kind: "link",
    key: "develop",
    label: "Develop",
    to: `/projects/${project.id}/develop`,
    end: true,
  },
  {
    kind: "link",
    key: "develop-review",
    label: "Project Review",
    to: `/projects/${project.id}/develop/review`,
    end: true,
  },
  {
    kind: "link",
    key: "develop-debug",
    label: "Context Debug",
    to: `/projects/${project.id}/develop/debug`,
    end: true,
  },
];

export const getFeatureTabUrl = (
  projectId: string,
  featureId: string,
  tab?: TabKind,
): string => {
  const basePath = `/projects/${projectId}/features/${featureId}`;
  return tab ? `${basePath}/${tab}` : basePath;
};

export type TabKind =
  | "product"
  | "ux"
  | "tech"
  | "user_docs"
  | "arch_docs"
  | "tasks";
