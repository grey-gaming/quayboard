import { questionnaireDefinition } from "@quayboard/shared";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Alert } from "../components/ui/Alert.js";
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
      />
      <Card>
        <form
          className="grid gap-5"
          onSubmit={handleSubmit(async (values) => {
            await updateQuestionnaireMutation.mutateAsync(values);
          })}
        >
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
          <div className="flex flex-wrap gap-3">
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
      <Card>
        <p className="font-semibold">Current Overview</p>
        <pre className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {onePagerQuery.data?.onePager?.markdown ?? "No overview generated yet."}
        </pre>
      </Card>
      <Card>
        <p className="font-semibold">Overview Versions</p>
        <div className="mt-4 grid gap-3">
          {versionsQuery.data?.versions.map((version) => (
            <div key={version.id} className="flex items-center justify-between gap-3">
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
                variant="secondary"
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="font-semibold">Background Jobs</p>
        <div className="mt-4 grid gap-2">
          {jobsQuery.data?.jobs.slice(0, 6).map((job) => (
            <div key={job.id} className="text-sm text-muted-foreground">
              {job.type}: {job.status}
            </div>
          ))}
        </div>
      </Card>
    </AppFrame>
  );
};
