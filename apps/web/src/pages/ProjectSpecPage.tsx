import type { ArtifactType, BlueprintKind, DecisionCard, Job, ProjectBlueprint } from "@quayboard/shared";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { EditableMarkdownDocument } from "../components/composites/EditableMarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { NextActionBar } from "../components/workflow/NextActionBar.js";
import { ReviewPanel } from "../components/workflow/ReviewPanel.js";
import { TransitionConfirmDialog } from "../components/workflow/TransitionConfirmDialog.js";
import { Alert } from "../components/ui/Alert.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useAcceptSpecDecisionTilesMutation,
  useApproveArtifactMutation,
  useArtifactStateQuery,
  useGenerateProjectSpecMutation,
  useGenerateSpecDecisionTilesMutation,
  useProjectJobsQuery,
  useProjectQuery,
  useProjectSpecQuery,
  useProjectSpecVersionsQuery,
  useRestoreProjectSpecMutation,
  useRunArtifactReviewMutation,
  useSaveProjectSpecMutation,
  useSpecDecisionTilesQuery,
  useUpdateArtifactReviewItemMutation,
  useUpdateSpecDecisionTilesMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

const DecisionTiles = ({
  cards,
  isUpdating,
  onSelectOption,
  onSaveCustomSelection,
}: {
  cards: DecisionCard[];
  isUpdating: boolean;
  onSaveCustomSelection: (card: DecisionCard, customSelection: string) => void;
  onSelectOption: (card: DecisionCard, optionId: string) => void;
}) => {
  const [customSelections, setCustomSelections] = useState<Record<string, string>>({});

  return (
    <div className="grid gap-4">
      {cards.map((card) => {
        const options = [card.recommendation, ...card.alternatives];
        const selectedOptionId = card.selectedOptionId;
        const customSelection = customSelections[card.id] ?? card.customSelection ?? "";

        return (
          <Card key={card.id} surface="panel">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">{card.category}</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{card.title}</p>
              </div>
              <Badge tone={card.acceptedAt ? "success" : "warning"}>
                {card.acceptedAt ? "accepted" : "acceptance required"}
              </Badge>
            </div>
            <p className="mt-4 text-sm text-secondary">{card.prompt}</p>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {options.map((option) => {
                const isRecommendation = option.id === card.recommendation.id;
                const isSelected = selectedOptionId === option.id && !card.customSelection;

                return (
                  <div
                    key={option.id}
                    className={[
                      "border px-4 py-4",
                      isSelected
                        ? "border-accent/60 bg-accent/10"
                        : "border-border/80 bg-panel-inset",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-foreground">{option.label}</p>
                      {isRecommendation ? <Badge tone="info">recommended</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-secondary">{option.description}</p>
                    <Button
                      className="mt-4"
                      disabled={isUpdating}
                      onClick={() => {
                        onSelectOption(card, option.id);
                      }}
                      variant={isSelected ? "primary" : "secondary"}
                    >
                      {isSelected ? "Selected" : "Choose Option"}
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor={`decision-custom-${card.id}`}>Custom selection</Label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id={`decision-custom-${card.id}`}
                  onChange={(event) => {
                    setCustomSelections((current) => ({
                      ...current,
                      [card.id]: event.target.value,
                    }));
                  }}
                  value={customSelection}
                />
                <Button
                  disabled={isUpdating || !customSelection.trim()}
                  onClick={() => {
                    onSaveCustomSelection(card, customSelection.trim());
                  }}
                  variant="ghost"
                >
                  Save Custom Choice
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

const ManualSpecComposer = ({
  defaultTitle,
  isSaving,
  onSave,
}: {
  defaultTitle: string;
  isSaving: boolean;
  onSave: (title: string, markdown: string) => void;
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [markdown, setMarkdown] = useState("");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`manual-title-${defaultTitle}`}>Specification title</Label>
        <Input
          id={`manual-title-${defaultTitle}`}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
          value={title}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`manual-markdown-${defaultTitle}`}>Manual draft</Label>
        <Textarea
          className="min-h-[24rem] font-mono text-[13px]"
          id={`manual-markdown-${defaultTitle}`}
          onChange={(event) => {
            setMarkdown(event.target.value);
          }}
          value={markdown}
        />
      </div>
      <div className="flex justify-end">
        <Button
          disabled={isSaving || !title.trim() || !markdown.trim()}
          onClick={() => {
            onSave(title.trim(), markdown.trim());
          }}
          variant="secondary"
        >
          {isSaving ? "Saving..." : `Save ${defaultTitle}`}
        </Button>
      </div>
    </div>
  );
};

const jobHasKind = (job: Job, kind: BlueprintKind) =>
  typeof job.inputs === "object" &&
  job.inputs !== null &&
  "kind" in job.inputs &&
  job.inputs.kind === kind;

const kindToArtifactType = (kind: BlueprintKind): ArtifactType =>
  kind === "ux" ? "blueprint_ux" : "blueprint_tech";

const kindToTitle = (kind: BlueprintKind) => (kind === "ux" ? "UX Spec" : "Technical Spec");
const kindToDecisionTitle = (kind: BlueprintKind) =>
  kind === "ux" ? "UX Decision Tiles" : "Technical Decision Tiles";

export const ProjectSpecPage = ({ kind }: { kind: BlueprintKind }) => {
  const { id = "" } = useParams();
  const location = useLocation();
  const [confirmApproval, setConfirmApproval] = useState(false);
  const projectQuery = useProjectQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const decisionTilesQuery = useSpecDecisionTilesQuery(id, kind);
  const specQuery = useProjectSpecQuery(id, kind);
  const specVersionsQuery = useProjectSpecVersionsQuery(id, kind);
  const generateDecisionTilesMutation = useGenerateSpecDecisionTilesMutation(id, kind);
  const updateDecisionTilesMutation = useUpdateSpecDecisionTilesMutation(id, kind);
  const acceptDecisionTilesMutation = useAcceptSpecDecisionTilesMutation(id, kind);
  const generateSpecMutation = useGenerateProjectSpecMutation(id, kind);
  const saveSpecMutation = useSaveProjectSpecMutation(id, kind);
  const restoreSpecMutation = useRestoreProjectSpecMutation(id, kind);
  const runArtifactReviewMutation = useRunArtifactReviewMutation(id);
  const updateArtifactReviewItemMutation = useUpdateArtifactReviewItemMutation(id);
  const approveArtifactMutation = useApproveArtifactMutation(id);

  useSseEvents(id);

  const title = kindToTitle(kind);
  const decisionTitle = kindToDecisionTitle(kind);
  const artifactType = kindToArtifactType(kind);
  const currentSpec = specQuery.data?.blueprint ?? null;
  const cards = decisionTilesQuery.data?.cards ?? [];
  const artifactStateQuery = useArtifactStateQuery(id, artifactType, currentSpec?.id ?? null);
  const redirectedFromLockedSection =
    typeof location.state === "object" &&
    location.state !== null &&
    "lockedFromPath" in location.state &&
    typeof location.state.lockedFromPath === "string"
      ? location.state.lockedFromPath
      : null;

  const activeDecisionJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          job.type === "GenerateDecisionDeck" &&
          jobHasKind(job, kind) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs, kind],
  );
  const activeSpecJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          job.type === "GenerateProjectBlueprint" &&
          jobHasKind(job, kind) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs, kind],
  );
  const activeReviewJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          job.type === (kind === "ux" ? "ReviewBlueprintUX" : "ReviewBlueprintTech") &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs, kind],
  );

  const decisionsGenerated = cards.length > 0;
  const decisionsComplete = decisionsGenerated && cards.every((card) => card.selectedOptionId || card.customSelection);
  const decisionsAccepted = decisionsComplete && cards.every((card) => Boolean(card.acceptedAt));
  const activeError =
    projectQuery.error ||
    decisionTilesQuery.error ||
    specQuery.error ||
    specVersionsQuery.error ||
    jobsQuery.error ||
    artifactStateQuery.error ||
    generateDecisionTilesMutation.error ||
    updateDecisionTilesMutation.error ||
    acceptDecisionTilesMutation.error ||
    generateSpecMutation.error ||
    saveSpecMutation.error ||
    restoreSpecMutation.error ||
    runArtifactReviewMutation.error ||
    updateArtifactReviewItemMutation.error ||
    approveArtifactMutation.error;

  return (
    <AppFrame>
      {projectQuery.data ? <ProjectSubNav project={projectQuery.data} /> : null}
      <PageIntro
        actions={
          <AiWorkflowButton
            active={generateDecisionTilesMutation.isPending || Boolean(activeDecisionJob)}
            disabled={generateDecisionTilesMutation.isPending || Boolean(activeDecisionJob)}
            label={decisionsGenerated ? `Regenerate ${decisionTitle}` : `Generate ${decisionTitle}`}
            onClick={() => {
              void generateDecisionTilesMutation.mutateAsync();
            }}
            runningLabel={`Generating ${decisionTitle}`}
            variant="secondary"
          />
        }
        eyebrow={title}
        title={title}
        summary={
          kind === "ux"
            ? "Select and accept UX decisions, then generate, refine, review, and approve the UX Spec."
            : "Use the approved UX Spec to drive technical decisions, then generate, refine, review, and approve the Technical Spec."
        }
        meta={
          <>
            <Badge tone={decisionsAccepted ? "success" : "warning"}>
              {decisionsAccepted ? "decisions accepted" : "decision acceptance required"}
            </Badge>
            <Badge tone={currentSpec ? "success" : "warning"}>
              {currentSpec ? `${title} present` : `${title} pending`}
            </Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {redirectedFromLockedSection ? (
        <Alert tone="info">
          {kind === "ux"
            ? "Approve the UX Spec on this page to continue to Technical Spec."
            : `Complete ${title} prerequisites on this page.`}{" "}
          You were redirected from <span className="font-mono"> {redirectedFromLockedSection}</span>.
        </Alert>
      ) : null}
      {activeDecisionJob ? (
        <Alert tone="info">{decisionTitle} generation is {activeDecisionJob.status}.</Alert>
      ) : null}
      {activeSpecJob ? <Alert tone="info">{title} generation is {activeSpecJob.status}.</Alert> : null}
      {activeReviewJob ? <Alert tone="info">{title} review is {activeReviewJob.status}.</Alert> : null}

      <div className="grid gap-4">
        <Card surface="panel">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <p className="qb-meta-label">Decisions</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{decisionTitle}</p>
            </div>
            <Badge tone="neutral">{cards.length} tiles</Badge>
          </div>
          <div className="mt-4">
            {cards.length > 0 ? (
              <DecisionTiles
                cards={cards}
                isUpdating={updateDecisionTilesMutation.isPending}
                onSaveCustomSelection={(card, customSelection) => {
                  void updateDecisionTilesMutation.mutateAsync({
                    cards: [{ id: card.id, customSelection }],
                  });
                }}
                onSelectOption={(card, optionId) => {
                  void updateDecisionTilesMutation.mutateAsync({
                    cards: [{ id: card.id, selectedOptionId: optionId }],
                  });
                }}
              />
            ) : (
              <p className="text-sm text-secondary">
                No {decisionTitle.toLowerCase()} exist yet. Generate them from the page header to
                start this phase.
              </p>
            )}
          </div>
        </Card>

        <NextActionBar
          summary={`Select every ${decisionTitle.toLowerCase()} option, then accept the full set before ${title} generation or manual authoring is enabled.`}
          title={`${title} decisions`}
        >
          <Button
            disabled={
              !decisionsComplete ||
              decisionsAccepted ||
              acceptDecisionTilesMutation.isPending
            }
            onClick={() => {
              void acceptDecisionTilesMutation.mutateAsync();
            }}
            variant="secondary"
          >
            {acceptDecisionTilesMutation.isPending ? "Accepting..." : `Accept ${kind === "ux" ? "UX" : "Technical"} Decisions`}
          </Button>
        </NextActionBar>

        <Card surface="panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <p className="qb-meta-label">Document</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AiWorkflowButton
                active={generateSpecMutation.isPending || Boolean(activeSpecJob)}
                disabled={
                  !decisionsAccepted ||
                  generateSpecMutation.isPending ||
                  Boolean(activeSpecJob)
                }
                label={currentSpec ? `Regenerate ${title}` : `Generate ${title}`}
                onClick={() => {
                  void generateSpecMutation.mutateAsync();
                }}
                runningLabel={`Generating ${title}`}
                variant="secondary"
              />
              <Button
                disabled={
                  approveArtifactMutation.isPending ||
                  !currentSpec ||
                  !artifactStateQuery.data?.latestReviewRun ||
                  artifactStateQuery.data.latestReviewRun.status !== "succeeded" ||
                  (artifactStateQuery.data.openBlockerCount ?? 0) > 0
                }
                onClick={() => {
                  setConfirmApproval(true);
                }}
                type="button"
                variant="secondary"
              >
                {`Approve ${title}`}
              </Button>
            </div>
          </div>
          <div className="mt-4">
            {currentSpec ? (
              <EditableMarkdownDocument
                disabled={Boolean(activeSpecJob)}
                isSaving={saveSpecMutation.isPending}
                markdown={currentSpec.markdown}
                onSave={async (markdown) => {
                  await saveSpecMutation.mutateAsync({
                    title: currentSpec.title,
                    markdown,
                  });
                }}
                saveLabel={`Save ${title}`}
              />
            ) : decisionsAccepted ? (
              <ManualSpecComposer
                defaultTitle={title}
                isSaving={saveSpecMutation.isPending}
                onSave={(manualTitle, markdown) => {
                  void saveSpecMutation.mutateAsync({ title: manualTitle, markdown });
                }}
              />
            ) : (
              <p className="text-sm text-secondary">
                Accept the {decisionTitle.toLowerCase()} before generating or saving the {title}.
              </p>
            )}
          </div>
        </Card>

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_22rem]">
          <Card surface="rail">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">History</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">{title} Versions</p>
              </div>
              <Badge tone="neutral">{specVersionsQuery.data?.versions.length ?? 0} versions</Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {specVersionsQuery.data?.versions.length ? (
                specVersionsQuery.data.versions.map((version) => (
                  <div
                    key={version.id}
                    className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Version {version.version} {version.isCanonical ? "(canonical)" : ""}
                        </p>
                        <p className="qb-meta-label">{formatDateTime(version.createdAt)}</p>
                      </div>
                      <Button
                        disabled={restoreSpecMutation.isPending}
                        onClick={() => {
                          void restoreSpecMutation.mutateAsync(version.version);
                        }}
                        type="button"
                        variant="ghost"
                      >
                        Restore
                      </Button>
                    </div>
                    <p className="text-sm text-secondary">{version.source}</p>
                  </div>
                ))
              ) : (
                <div className="bg-panel-inset px-4 py-4 text-sm text-secondary">
                  No {title} versions yet.
                </div>
              )}
            </div>
          </Card>
          <ReviewPanel
            isUpdating={updateArtifactReviewItemMutation.isPending}
            items={artifactStateQuery.data?.reviewItems ?? []}
            onUpdate={(reviewItemId, status) => {
              void updateArtifactReviewItemMutation.mutateAsync({ reviewItemId, status });
            }}
          />
        </div>

        <NextActionBar
          summary={`Run review on the current canonical ${title} when you are ready to validate it.`}
          title={`${title} review`}
        >
          <Button
            disabled={
              runArtifactReviewMutation.isPending ||
              Boolean(activeReviewJob) ||
              !currentSpec
            }
            onClick={() => {
              if (!currentSpec) {
                return;
              }

              void runArtifactReviewMutation.mutateAsync({
                artifactId: currentSpec.id,
                artifactType,
              });
            }}
            variant="ghost"
          >
            {activeReviewJob ? "Running Review" : "Run Review"}
          </Button>
        </NextActionBar>
      </div>

      <TransitionConfirmDialog
        confirmLabel={`Approve ${title}`}
        isOpen={confirmApproval}
        isPending={approveArtifactMutation.isPending}
        onCancel={() => {
          setConfirmApproval(false);
        }}
        onConfirm={() => {
          if (!currentSpec) {
            return;
          }

          void approveArtifactMutation
            .mutateAsync({ artifactId: currentSpec.id, artifactType })
            .then(() => {
              setConfirmApproval(false);
            });
        }}
        title={`Approve ${title}`}
      />
    </AppFrame>
  );
};
