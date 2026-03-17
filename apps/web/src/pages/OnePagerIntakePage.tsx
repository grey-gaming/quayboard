import { questionnaireDefinition } from "@quayboard/shared";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { MarkdownDocument } from "../components/composites/MarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useApproveOnePagerMutation,
  useGenerateDescriptionMutation,
  useGenerateOnePagerMutation,
  useOnePagerQuery,
  useOnePagerVersionsQuery,
  useProjectJobsQuery,
  useProjectQuery,
  useQuestionnaireQuery,
  useRestoreOnePagerMutation,
  useSetupStatusQuery,
  useUpdateQuestionnaireMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

type FormValues = Record<string, string>;

const jobTone = (status: string) =>
  status === "succeeded"
    ? "success"
    : status === "failed" || status === "cancelled"
      ? "danger"
      : "info";

export const OnePagerIntakePage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupStatusQuery = useSetupStatusQuery(id);
  const questionnaireQuery = useQuestionnaireQuery(id);
  const onePagerQuery = useOnePagerQuery(id);
  const versionsQuery = useOnePagerVersionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const updateQuestionnaireMutation = useUpdateQuestionnaireMutation(id);
  const generateDescriptionMutation = useGenerateDescriptionMutation(id);
  const generateOnePagerMutation = useGenerateOnePagerMutation(id, "generate");
  const approveOnePagerMutation = useApproveOnePagerMutation(id);
  const restoreOnePagerMutation = useRestoreOnePagerMutation(id);
  const { handleSubmit, register } = useForm<FormValues>({
    values: questionnaireQuery.data?.answers ?? {},
  });

  useSseEvents(id);

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectContextHeader project={projectQuery.data} setupStatus={setupStatusQuery.data} />
      ) : null}
      <PageIntro
        eyebrow="Overview"
        title="Questionnaire And Overview Document"
        summary="Capture project intent, then queue description and overview generation jobs against the configured provider."
        meta={
          <>
            <Badge tone="neutral">14-question intake</Badge>
            <Badge tone={onePagerQuery.data?.onePager ? "success" : "warning"}>
              {onePagerQuery.data?.onePager ? "overview present" : "overview pending"}
            </Badge>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <Card surface="panel">
          <form
            className="grid gap-5"
            onSubmit={handleSubmit(async (values) => {
              await updateQuestionnaireMutation.mutateAsync(values);
            })}
          >
            <div className="qb-section-heading">
              <p className="qb-meta-label">Intake questionnaire</p>
              <p className="text-sm text-secondary">
                Capture product intent before generating the canonical overview document.
              </p>
            </div>
            {questionnaireDefinition.map((question) => (
              <div key={question.key} className="space-y-2">
                <Label htmlFor={question.key}>{question.title}</Label>
                <Textarea
                  id={question.key}
                  placeholder={question.prompt}
                  {...register(question.key)}
                />
                {question.helpText ? (
                  <p className="text-xs text-muted-foreground">{question.helpText}</p>
                ) : null}
              </div>
            ))}
            {updateQuestionnaireMutation.error ? (
              <Alert tone="error">{updateQuestionnaireMutation.error.message}</Alert>
            ) : null}
            <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
              <Button disabled={updateQuestionnaireMutation.isPending} type="submit">
                Save Answers
              </Button>
              <Button
                disabled={generateDescriptionMutation.isPending}
                onClick={() => {
                  void generateDescriptionMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Generate Description
              </Button>
              <Button
                disabled={generateOnePagerMutation.isPending}
                onClick={() => {
                  void generateOnePagerMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Generate Overview
              </Button>
              <Button
                disabled={!onePagerQuery.data?.onePager || approveOnePagerMutation.isPending}
                onClick={() => {
                  void approveOnePagerMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Approve Overview
              </Button>
            </div>
          </form>
        </Card>
        <div className="grid gap-4">
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Document</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Current Overview</p>
              </div>
              <Badge tone={onePagerQuery.data?.onePager ? "success" : "warning"}>
                {onePagerQuery.data?.onePager ? "generated" : "empty"}
              </Badge>
            </div>
            <div className="mt-4 border border-border/80 bg-panel px-4 py-4">
              {onePagerQuery.data?.onePager ? (
                <MarkdownDocument markdown={onePagerQuery.data.onePager.markdown} />
              ) : (
                <p className="text-sm text-secondary">No overview generated yet.</p>
              )}
            </div>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card surface="rail">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">History</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Overview Versions</p>
                </div>
                <Badge tone="neutral">{versionsQuery.data?.versions.length ?? 0} versions</Badge>
              </div>
              <div className="mt-4 grid gap-0 border border-border/80">
                {versionsQuery.data?.versions.map((version) => (
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
                        disabled={restoreOnePagerMutation.isPending}
                        onClick={() => {
                          void restoreOnePagerMutation.mutateAsync(version.version);
                        }}
                        variant="ghost"
                      >
                        Restore
                      </Button>
                    </div>
                    <p className="text-sm text-secondary">
                      {version.approvedAt
                        ? `approved ${formatDateTime(version.approvedAt)}`
                        : "awaiting approval"}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
            <Card surface="rail">
              <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
                <div>
                  <p className="qb-meta-label">Background</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Background Jobs</p>
                </div>
                <Badge tone="neutral">{jobsQuery.data?.jobs.length ?? 0} jobs</Badge>
              </div>
              <div className="mt-4 grid gap-0 border border-border/80">
                {jobsQuery.data?.jobs.slice(0, 6).map((job) => (
                  <div
                    key={job.id}
                    className="grid gap-2 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{job.type}</p>
                      <Badge tone={jobTone(job.status)}>{job.status}</Badge>
                    </div>
                    <p className="qb-meta-label">queued {formatDateTime(job.queuedAt)}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppFrame>
  );
};
