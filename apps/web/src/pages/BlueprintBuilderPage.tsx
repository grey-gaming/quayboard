import type { ArtifactType, BlueprintKind, DecisionCard, ProjectBlueprint } from "@quayboard/shared";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";

import { EditableMarkdownDocument } from "../components/composites/EditableMarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { NextActionBar } from "../components/workflow/NextActionBar.js";
import { ReviewPanel } from "../components/workflow/ReviewPanel.js";
import { TransitionConfirmDialog } from "../components/workflow/TransitionConfirmDialog.js";
import { WorkflowLoop } from "../components/workflow/WorkflowLoop.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useApproveArtifactMutation,
  useArtifactStateQuery,
  useBlueprintsQuery,
  useDecisionCardsQuery,
  useGenerateBlueprintMutation,
  useGenerateDecisionDeckMutation,
  usePhaseGatesQuery,
  useProjectJobsQuery,
  useProjectQuery,
  useRunArtifactReviewMutation,
  useSaveBlueprintMutation,
  useUpdateArtifactReviewItemMutation,
  useUpdateDecisionCardsMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

const generateDeckJobTypes = new Set(["GenerateDecisionDeck"]);
const generateBlueprintJobTypes = new Set(["GenerateProjectBlueprint"]);
const reviewBlueprintJobTypes = new Set(["ReviewBlueprintUX", "ReviewBlueprintTech"]);

type BlueprintView = "deck" | "tech" | "ux";

const viewToKind = (view: Exclude<BlueprintView, "deck">): BlueprintKind =>
  view === "ux" ? "ux" : "tech";

const viewToArtifactType = (view: Exclude<BlueprintView, "deck">): ArtifactType =>
  view === "ux" ? "blueprint_ux" : "blueprint_tech";

const DecisionCardDeck = ({
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
              <Badge tone={card.selectedOptionId || card.customSelection ? "success" : "warning"}>
                {card.selectedOptionId || card.customSelection ? "selected" : "selection required"}
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
      {cards.length === 0 ? (
        <Card surface="inset">
          <p className="text-sm text-secondary">
            No decision deck exists yet. Generate it from the action bar to start Blueprint Builder.
          </p>
        </Card>
      ) : null}
    </div>
  );
};

const BlueprintDocumentView = ({
  defaultTitle,
  onSave,
  blueprint,
  kind,
  isSaving,
}: {
  blueprint: ProjectBlueprint | null;
  defaultTitle: string;
  isSaving: boolean;
  kind: BlueprintKind;
  onSave: (title: string, markdown: string) => void;
}) => {
  const [manualTitle, setManualTitle] = useState(defaultTitle);
  const [manualMarkdown, setManualMarkdown] = useState("");

  if (blueprint) {
    return (
      <EditableMarkdownDocument
        isSaving={isSaving}
        markdown={blueprint.markdown}
        onSave={async (markdown) => {
          onSave(blueprint.title, markdown);
        }}
        saveLabel={`Save ${kind === "ux" ? "UX" : "Tech"} Blueprint`}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`manual-title-${kind}`}>Blueprint title</Label>
        <Input
          id={`manual-title-${kind}`}
          onChange={(event) => {
            setManualTitle(event.target.value);
          }}
          value={manualTitle}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`manual-markdown-${kind}`}>Manual blueprint draft</Label>
        <Textarea
          className="min-h-[24rem] font-mono text-[13px]"
          id={`manual-markdown-${kind}`}
          onChange={(event) => {
            setManualMarkdown(event.target.value);
          }}
          value={manualMarkdown}
        />
      </div>
      <div className="flex justify-end">
        <Button
          disabled={isSaving || !manualTitle.trim() || !manualMarkdown.trim()}
          onClick={() => {
            onSave(manualTitle.trim(), manualMarkdown.trim());
          }}
          variant="secondary"
        >
          {isSaving ? "Saving..." : `Save ${kind === "ux" ? "UX" : "Tech"} Blueprint`}
        </Button>
      </div>
    </div>
  );
};

export const BlueprintBuilderPage = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const [activeView, setActiveView] = useState<BlueprintView>("deck");
  const [confirmKind, setConfirmKind] = useState<BlueprintKind | null>(null);
  const projectQuery = useProjectQuery(id);
  const phaseGatesQuery = usePhaseGatesQuery(id);
  const decisionCardsQuery = useDecisionCardsQuery(id);
  const blueprintsQuery = useBlueprintsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const generateDecisionDeckMutation = useGenerateDecisionDeckMutation(id);
  const updateDecisionCardsMutation = useUpdateDecisionCardsMutation(id);
  const generateBlueprintMutation = useGenerateBlueprintMutation(id);
  const saveBlueprintMutation = useSaveBlueprintMutation(id);
  const runArtifactReviewMutation = useRunArtifactReviewMutation(id);
  const updateArtifactReviewItemMutation = useUpdateArtifactReviewItemMutation(id);
  const approveArtifactMutation = useApproveArtifactMutation(id);

  useSseEvents(id);

  const redirectedFromLockedSection =
    typeof location.state === "object" &&
    location.state !== null &&
    "lockedFromPath" in location.state &&
    typeof location.state.lockedFromPath === "string"
      ? location.state.lockedFromPath
      : null;

  const activeDeckJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          generateDeckJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const activeBlueprintJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          generateBlueprintJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const activeReviewJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          reviewBlueprintJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );

  const currentKind = activeView === "deck" ? null : viewToKind(activeView);
  const currentBlueprint =
    currentKind === "ux"
      ? blueprintsQuery.data?.uxBlueprint ?? null
      : currentKind === "tech"
        ? blueprintsQuery.data?.techBlueprint ?? null
        : null;
  const currentArtifactType =
    activeView === "deck" ? null : viewToArtifactType(activeView);
  const artifactStateQuery = useArtifactStateQuery(
    id,
    currentArtifactType ?? "blueprint_ux",
    currentBlueprint?.id ?? null,
  );

  const deckComplete = decisionCardsQuery.data?.cards.every(
    (card) => card.selectedOptionId || card.customSelection,
  );
  const activeError =
    projectQuery.error ||
    phaseGatesQuery.error ||
    decisionCardsQuery.error ||
    blueprintsQuery.error ||
    jobsQuery.error ||
    artifactStateQuery.error ||
    generateDecisionDeckMutation.error ||
    updateDecisionCardsMutation.error ||
    generateBlueprintMutation.error ||
    saveBlueprintMutation.error ||
    runArtifactReviewMutation.error ||
    updateArtifactReviewItemMutation.error ||
    approveArtifactMutation.error;

  return (
    <AppFrame>
      {projectQuery.data ? <ProjectSubNav project={projectQuery.data} /> : null}
      <PageIntro
        eyebrow="Blueprint"
        title="Blueprint Builder"
        summary="Generate the decision deck, lock key tradeoffs, produce UX and tech blueprints, and clear review before approval."
        meta={
          <>
            <Badge tone="neutral">m3 planning</Badge>
            <Badge tone="neutral">{decisionCardsQuery.data?.cards.length ?? 0} cards</Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {redirectedFromLockedSection ? (
        <Alert tone="info">
          Approve user flows before Blueprint Builder. You were redirected from
          <span className="font-mono"> {redirectedFromLockedSection}</span>.
        </Alert>
      ) : null}
      {activeDeckJob ? (
        <Alert tone="info">Decision deck generation is {activeDeckJob.status}.</Alert>
      ) : null}
      {activeBlueprintJob ? (
        <Alert tone="info">Blueprint generation is {activeBlueprintJob.status}.</Alert>
      ) : null}
      {activeReviewJob ? (
        <Alert tone="info">Blueprint review is {activeReviewJob.status}.</Alert>
      ) : null}

      <div className="grid gap-4">
        <WorkflowLoop
          currentPhase="Blueprint"
          phases={(phaseGatesQuery.data?.phases ?? []).map((phase) => ({
            label: phase.phase,
            passed: phase.passed,
          }))}
        />

        <Card surface="panel">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setActiveView("deck");
              }}
              variant={activeView === "deck" ? "primary" : "secondary"}
            >
              Decision Deck
            </Button>
            <Button
              onClick={() => {
                setActiveView("ux");
              }}
              variant={activeView === "ux" ? "primary" : "secondary"}
            >
              UX Blueprint
            </Button>
            <Button
              onClick={() => {
                setActiveView("tech");
              }}
              variant={activeView === "tech" ? "primary" : "secondary"}
            >
              Tech Blueprint
            </Button>
          </div>
        </Card>

        {activeView === "deck" ? (
          <DecisionCardDeck
            cards={decisionCardsQuery.data?.cards ?? []}
            isUpdating={updateDecisionCardsMutation.isPending}
            onSaveCustomSelection={(card, customSelection) => {
              void updateDecisionCardsMutation.mutateAsync({
                cards: [{ id: card.id, customSelection }],
              });
            }}
            onSelectOption={(card, optionId) => {
              void updateDecisionCardsMutation.mutateAsync({
                cards: [{ id: card.id, selectedOptionId: optionId }],
              });
            }}
          />
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_22rem]">
            <Card surface="panel">
              <BlueprintDocumentView
                blueprint={currentBlueprint}
                defaultTitle={activeView === "ux" ? "UX Blueprint" : "Tech Blueprint"}
                isSaving={saveBlueprintMutation.isPending}
                kind={currentKind!}
                onSave={(title, markdown) => {
                  void saveBlueprintMutation.mutateAsync({
                    kind: currentKind!,
                    title,
                    markdown,
                  });
                }}
              />
            </Card>
            <ReviewPanel
              isUpdating={updateArtifactReviewItemMutation.isPending}
              items={artifactStateQuery.data?.reviewItems ?? []}
              onUpdate={(reviewItemId, status) => {
                void updateArtifactReviewItemMutation.mutateAsync({ reviewItemId, status });
              }}
            />
          </div>
        )}

        <NextActionBar
          summary={
            activeView === "deck"
              ? "Generate the deck first, then select or customize every decision before blueprint generation."
              : "Generate or edit the blueprint, run review manually, then approve the canonical revision when blockers are clear."
          }
          title={activeView === "deck" ? "Decision deck actions" : "Blueprint actions"}
        >
          {activeView === "deck" ? (
            <Button
              disabled={generateDecisionDeckMutation.isPending || Boolean(activeDeckJob)}
              onClick={() => {
                void generateDecisionDeckMutation.mutateAsync();
              }}
              variant="secondary"
            >
              {activeDeckJob ? "Generating Deck" : "Generate Decision Deck"}
            </Button>
          ) : (
            <>
              <Button
                disabled={
                  generateBlueprintMutation.isPending || Boolean(activeBlueprintJob) || !deckComplete
                }
                onClick={() => {
                  void generateBlueprintMutation.mutateAsync({ kind: currentKind! });
                }}
                variant="secondary"
              >
                {currentBlueprint ? "Regenerate Blueprint" : "Generate Blueprint"}
              </Button>
              <Button
                disabled={
                  runArtifactReviewMutation.isPending ||
                  Boolean(activeReviewJob) ||
                  !currentBlueprint ||
                  !currentArtifactType
                }
                onClick={() => {
                  if (!currentBlueprint || !currentArtifactType) {
                    return;
                  }

                  void runArtifactReviewMutation.mutateAsync({
                    artifactId: currentBlueprint.id,
                    artifactType: currentArtifactType,
                  });
                }}
                variant="ghost"
              >
                {activeReviewJob ? "Running Review" : "Run Review"}
              </Button>
              <Button
                disabled={
                  approveArtifactMutation.isPending ||
                  !currentBlueprint ||
                  !currentArtifactType ||
                  !artifactStateQuery.data?.latestReviewRun ||
                  artifactStateQuery.data.latestReviewRun.status !== "succeeded" ||
                  (artifactStateQuery.data.openBlockerCount ?? 0) > 0
                }
                onClick={() => {
                  setConfirmKind(currentKind);
                }}
                variant="secondary"
              >
                Approve Blueprint
              </Button>
            </>
          )}
        </NextActionBar>
      </div>

      <TransitionConfirmDialog
        confirmLabel="Approve Blueprint"
        isOpen={Boolean(confirmKind)}
        isPending={approveArtifactMutation.isPending}
        onCancel={() => {
          setConfirmKind(null);
        }}
        onConfirm={() => {
          if (!confirmKind) {
            return;
          }

          const artifactType = confirmKind === "ux" ? "blueprint_ux" : "blueprint_tech";
          const artifactId =
            confirmKind === "ux"
              ? blueprintsQuery.data?.uxBlueprint?.id
              : blueprintsQuery.data?.techBlueprint?.id;

          if (!artifactId) {
            return;
          }

          void approveArtifactMutation
            .mutateAsync({ artifactId, artifactType })
            .then(() => {
              setConfirmKind(null);
            });
        }}
        title={`Approve ${confirmKind === "ux" ? "UX" : confirmKind === "tech" ? "Tech" : ""} Blueprint`}
      />
    </AppFrame>
  );
};
