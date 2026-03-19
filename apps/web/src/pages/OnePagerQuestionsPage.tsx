import { questionnaireDefinition } from "@quayboard/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import type { QuestionnaireAnswers } from "@quayboard/shared";

import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useAutoAnswerQuestionnaireMutation,
  useProjectQuery,
  useProjectJobsQuery,
  useQuestionnaireQuery,
  useUpdateQuestionnaireMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

type FormValues = Record<string, string>;

const emptyAnswers = questionnaireDefinition.reduce<FormValues>((accumulator, question) => {
  accumulator[question.key] = "";
  return accumulator;
}, {});

const questionKeys = questionnaireDefinition.map((question) => question.key);
const autoAnswerJobType = "AutoAnswerQuestionnaire";

const normalizeAnswers = (answers?: Partial<FormValues>) =>
  questionnaireDefinition.reduce<FormValues>((accumulator, question) => {
    accumulator[question.key] = answers?.[question.key] ?? "";
    return accumulator;
  }, {});

const answersEqual = (left: FormValues, right: FormValues) =>
  questionKeys.every((key) => left[key] === right[key]);

const formatAutosaveStatus = (
  autosaveState: "idle" | "dirty" | "saving" | "saved" | "error",
  updatedAt: string | undefined,
) => {
  if (autosaveState === "saving") {
    return "Saving answers...";
  }

  if (autosaveState === "dirty") {
    return "Unsaved changes pending.";
  }

  if (autosaveState === "saved" && updatedAt) {
    return `Saved ${formatDateTime(updatedAt)}`;
  }

  if (autosaveState === "error") {
    return "Autosave failed.";
  }

  return "Answers save automatically.";
};

const isTerminalJobStatus = (status: string | null | undefined) =>
  status === "succeeded" || status === "failed" || status === "cancelled";

export const OnePagerQuestionsPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const projectQuery = useProjectQuery(id);
  const questionnaireQuery = useQuestionnaireQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const updateQuestionnaireMutation = useUpdateQuestionnaireMutation(id);
  const autoAnswerQuestionnaireMutation = useAutoAnswerQuestionnaireMutation(id);
  const [autosaveState, setAutosaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>(undefined);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [queuedAutoAnswerJobId, setQueuedAutoAnswerJobId] = useState<string | null>(null);
  const hasHydratedRef = useRef(false);
  const skipDirtyCheckRef = useRef(false);
  const debounceHandleRef = useRef<number | null>(null);
  const lastSyncedAnswersRef = useRef<FormValues>(emptyAnswers);
  const { getValues, register, reset, watch } = useForm<FormValues>({
    defaultValues: emptyAnswers,
  });
  const watchedAnswers = watch();

  useSseEvents(id);

  useEffect(() => {
    if (!questionnaireQuery.data) {
      return;
    }

    const serverAnswers = normalizeAnswers(questionnaireQuery.data.answers);

    if (!hasHydratedRef.current) {
      skipDirtyCheckRef.current = true;
      reset(serverAnswers);
      lastSyncedAnswersRef.current = serverAnswers;
      hasHydratedRef.current = true;
      setLastSavedAt(questionnaireQuery.data.updatedAt);
      setAutosaveState(questionnaireQuery.data.updatedAt ? "saved" : "idle");
      return;
    }

    const currentValues = normalizeAnswers(getValues());
    const mergedValues = { ...currentValues };
    let shouldReset = false;

    for (const key of questionKeys) {
      const hasUnsavedLocalChange = currentValues[key] !== lastSyncedAnswersRef.current[key];

      if (!hasUnsavedLocalChange && currentValues[key] !== serverAnswers[key]) {
        mergedValues[key] = serverAnswers[key];
        shouldReset = true;
      }
    }

    lastSyncedAnswersRef.current = serverAnswers;
    setLastSavedAt(questionnaireQuery.data.updatedAt);

    if (shouldReset && !answersEqual(currentValues, mergedValues)) {
      skipDirtyCheckRef.current = true;
      reset(mergedValues);
      setAutosaveState(questionnaireQuery.data.updatedAt ? "saved" : "idle");
    }
  }, [getValues, questionnaireQuery.data, reset]);

  const flushAutosave = useCallback(async () => {
    if (debounceHandleRef.current) {
      window.clearTimeout(debounceHandleRef.current);
      debounceHandleRef.current = null;
    }

    if (!hasHydratedRef.current) {
      return null;
    }

    const currentValues = normalizeAnswers(getValues());
    const changedEntries = Object.entries(currentValues).filter(
      ([key, value]) => value !== lastSyncedAnswersRef.current[key],
    );

    if (changedEntries.length === 0) {
      setAutosaveState(lastSavedAt ? "saved" : "idle");
      return null;
    }

    setAutosaveState("saving");
    setAutosaveError(null);

    try {
      const response = await updateQuestionnaireMutation.mutateAsync(
        Object.fromEntries(changedEntries),
      );
      const syncedAnswers = normalizeAnswers(response.answers);
      lastSyncedAnswersRef.current = syncedAnswers;
      setLastSavedAt(response.updatedAt);
      setAutosaveState("saved");
      return response;
    } catch (error) {
      setAutosaveState("error");
      setAutosaveError(
        error instanceof Error ? error.message : "Autosave failed. Try again.",
      );
      throw error;
    }
  }, [getValues, lastSavedAt, updateQuestionnaireMutation]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (skipDirtyCheckRef.current) {
      skipDirtyCheckRef.current = false;
      return;
    }

    const currentValues = normalizeAnswers(watchedAnswers);
    const hasPendingChanges = !answersEqual(currentValues, lastSyncedAnswersRef.current);

    if (!hasPendingChanges) {
      setAutosaveState((currentState) =>
        currentState === "saving" ? currentState : lastSavedAt ? "saved" : "idle",
      );
      return;
    }

    setAutosaveState((currentState) => (currentState === "saving" ? currentState : "dirty"));

    if (debounceHandleRef.current) {
      window.clearTimeout(debounceHandleRef.current);
    }

    debounceHandleRef.current = window.setTimeout(() => {
      void flushAutosave();
    }, 700);

    return () => {
      if (debounceHandleRef.current) {
        window.clearTimeout(debounceHandleRef.current);
      }
    };
  }, [flushAutosave, lastSavedAt, watchedAnswers]);

  useEffect(
    () => () => {
      if (debounceHandleRef.current) {
        window.clearTimeout(debounceHandleRef.current);
      }
    },
    [],
  );

  const currentAnswers = normalizeAnswers(watchedAnswers);
  const questionnaireComplete = questionKeys.every((key) => Boolean(currentAnswers[key].trim()));
  const hasBlankAnswers = questionKeys.some((key) => !currentAnswers[key].trim());
  const activeAutoAnswerJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          job.type === autoAnswerJobType &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const trackedAutoAnswerJob = useMemo(
    () =>
      queuedAutoAnswerJobId
        ? jobsQuery.data?.jobs.find((job) => job.id === queuedAutoAnswerJobId) ?? null
        : null,
    [jobsQuery.data?.jobs, queuedAutoAnswerJobId],
  );
  const autoAnswerActive =
    autoAnswerQuestionnaireMutation.isPending ||
    Boolean(activeAutoAnswerJob) ||
    (queuedAutoAnswerJobId !== null && !isTerminalJobStatus(trackedAutoAnswerJob?.status));

  useEffect(() => {
    if (!queuedAutoAnswerJobId || !isTerminalJobStatus(trackedAutoAnswerJob?.status)) {
      return;
    }

    setQueuedAutoAnswerJobId(null);
  }, [queuedAutoAnswerJobId, trackedAutoAnswerJob?.status]);

  const activeError =
    questionnaireQuery.error ||
    jobsQuery.error ||
    updateQuestionnaireMutation.error ||
    autoAnswerQuestionnaireMutation.error;

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectSubNav project={projectQuery.data} />
      ) : null}
      <PageIntro
        eyebrow="Overview"
        title="Questions"
        summary="Capture project intent here. Answers save automatically, and you can ask the LLM to fill only the remaining gaps before generating the overview."
        meta={
          <>
            <Badge tone="neutral">14-question intake</Badge>
            <Badge tone={questionnaireComplete ? "success" : "warning"}>
              {questionnaireComplete ? "questionnaire complete" : "questions pending"}
            </Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {autosaveError ? <Alert tone="error">{autosaveError}</Alert> : null}

      <Card surface="panel">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/80 pb-4">
          <div className="grid gap-2">
            <div>
              <p className="qb-meta-label">Questionnaire</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Project Questions</p>
            </div>
            <p className="max-w-3xl text-sm text-secondary">
              Any answers you type are preserved. The LLM answer fill uses the current project name,
              saved project description, and any answers already present to fill blanks only.
            </p>
          </div>
          <div className="grid gap-2 text-right" data-testid="questionnaire-header-actions">
            <AiWorkflowButton
              disabled={updateQuestionnaireMutation.isPending || autoAnswerActive || !hasBlankAnswers}
              label="Generate Answers"
              onClick={() => {
                void flushAutosave()
                  .then(() => autoAnswerQuestionnaireMutation.mutateAsync())
                  .then((job) => {
                    setQueuedAutoAnswerJobId(job.id);
                  })
                  .catch(() => undefined);
              }}
              runningLabel="Generating Answers"
              type="button"
              active={autoAnswerActive}
            />
            <Badge tone={autosaveState === "error" ? "danger" : "neutral"}>
              {formatAutosaveStatus(autosaveState, lastSavedAt)}
            </Badge>
            {questionnaireQuery.data?.completedAt ? (
              <p className="qb-meta-label">
                complete {formatDateTime(questionnaireQuery.data.completedAt)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-5">
          {questionnaireDefinition.map((question) => {
            const field = register(question.key);

            return (
              <div key={question.key} className="space-y-2">
                <Label htmlFor={question.key}>{question.title}</Label>
                <Textarea
                  id={question.key}
                  placeholder={question.prompt}
                  {...field}
                  onBlur={(event) => {
                    field.onBlur(event);
                    void flushAutosave();
                  }}
                />
                {question.helpText ? (
                  <p className="text-xs text-muted-foreground">{question.helpText}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border/80 pt-4"
          data-testid="questionnaire-footer-actions"
        >
          <Button
            disabled={
              autoAnswerActive ||
              updateQuestionnaireMutation.isPending ||
              !questionnaireComplete
            }
            onClick={() => {
              void flushAutosave()
                .then((response) => {
                  const questionnaireCompleted =
                    response?.completedAt !== null || questionnaireComplete;

                  navigate(`/projects/${id}/one-pager`, {
                    state: {
                      questionnaireCompleted,
                      startGeneration: true,
                    },
                  });
                })
                .catch(() => undefined);
            }}
            type="button"
          >
            Next: Generate Overview
          </Button>
        </div>
      </Card>
    </AppFrame>
  );
};
