import { questionnaireDefinition } from "@quayboard/shared";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
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

type FormValues = Record<string, string>;

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
        <ProjectContextHeader
          project={projectQuery.data}
          setupStatus={setupStatusQuery.data}
        />
      ) : null}
      <PageIntro
        eyebrow="Overview"
        title="Questionnaire And Overview Document"
        summary="Capture project intent, then queue description and overview generation jobs against the configured provider."
        meta={
          <>
            <Badge tone="info">14-question intake</Badge>
            <Badge tone={onePagerQuery.data?.onePager ? "success" : "warning"}>
              {onePagerQuery.data?.onePager ? "overview present" : "overview pending"}
            </Badge>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="grid gap-5">
          <Card surface="rail">
            <form
              className="grid gap-5"
          onSubmit={handleSubmit(async (values) => {
            await updateQuestionnaireMutation.mutateAsync(values);
          })}
            >
              <div className="grid gap-2 border-b border-border/70 pb-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Intake Questionnaire
                </p>
                <p className="text-sm text-muted-foreground">
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
              <div className="flex flex-wrap gap-3 border-t border-border/70 pt-4">
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
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold tracking-tight">Current Overview</p>
              <Badge tone={onePagerQuery.data?.onePager ? "success" : "warning"}>
                {onePagerQuery.data?.onePager ? "generated" : "empty"}
              </Badge>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border/80 bg-panel/76 p-4 text-sm text-muted-foreground">
              {onePagerQuery.data?.onePager?.markdown ?? "No overview generated yet."}
            </pre>
          </Card>
        </div>
        <div className="grid gap-5">
          <Card surface="rail">
            <p className="font-semibold tracking-tight">Overview Versions</p>
            <div className="mt-4 grid gap-3">
              {versionsQuery.data?.versions.map((version) => (
                <div key={version.id} className="rounded-md border border-border/80 bg-panel/76 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        Version {version.version} {version.isCanonical ? "(canonical)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{version.createdAt}</p>
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
                </div>
              ))}
            </div>
          </Card>
          <Card surface="panel">
            <p className="font-semibold tracking-tight">Background Jobs</p>
            <div className="mt-4 grid gap-3">
              {jobsQuery.data?.jobs.slice(0, 6).map((job) => (
                <div key={job.id} className="rounded-md border border-border/80 bg-panel/76 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{job.type}</p>
                    <Badge
                      tone={
                        job.status === "succeeded"
                          ? "success"
                          : job.status === "failed" || job.status === "cancelled"
                            ? "danger"
                            : "info"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </AppFrame>
  );
};
