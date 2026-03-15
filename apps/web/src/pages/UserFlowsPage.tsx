import { useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectContextHeader } from "../components/layout/ProjectContextHeader.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import {
  useApproveUserFlowsMutation,
  useCreateUserFlowMutation,
  useDeleteUserFlowMutation,
  useDedupeUserFlowsMutation,
  useGenerateUserFlowsMutation,
  useProjectQuery,
  useSetupStatusQuery,
  useUserFlowsQuery,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";

type FormValues = {
  acceptanceCriteria: string;
  coverageTags: string;
  endState: string;
  entryPoint: string;
  flowSteps: string;
  title: string;
  userStory: string;
};

export const UserFlowsPage = () => {
  const { id = "" } = useParams();
  const projectQuery = useProjectQuery(id);
  const setupStatusQuery = useSetupStatusQuery(id);
  const userFlowsQuery = useUserFlowsQuery(id);
  const createUserFlowMutation = useCreateUserFlowMutation(id);
  const deleteUserFlowMutation = useDeleteUserFlowMutation(id);
  const generateUserFlowsMutation = useGenerateUserFlowsMutation(id);
  const dedupeUserFlowsMutation = useDedupeUserFlowsMutation(id);
  const approveUserFlowsMutation = useApproveUserFlowsMutation(id);
  const [acceptedWarnings, setAcceptedWarnings] = useState<string[]>([]);
  const { handleSubmit, register, reset } = useForm<FormValues>({
    defaultValues: {
      acceptanceCriteria: "",
      coverageTags: "happy-path",
      endState: "",
      entryPoint: "",
      flowSteps: "",
      title: "",
      userStory: "",
    },
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
        eyebrow="User Flows"
        title="User Flows"
        summary="Generate, edit, and approve the user-facing journeys that become the planning contract for later stages."
        meta={
          <>
            <Badge tone="info">planning contract</Badge>
            <Badge tone="neutral">
              {userFlowsQuery.data?.userFlows.length ?? 0} flows
            </Badge>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
        <div className="grid gap-5">
          <Card surface="rail">
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={generateUserFlowsMutation.isPending}
                onClick={() => {
                  void generateUserFlowsMutation.mutateAsync();
                }}
              >
                Generate Flows
              </Button>
              <Button
                disabled={dedupeUserFlowsMutation.isPending}
                onClick={() => {
                  void dedupeUserFlowsMutation.mutateAsync();
                }}
                variant="secondary"
              >
                Deduplicate
              </Button>
              <Button
                disabled={approveUserFlowsMutation.isPending}
                onClick={() => {
                  void approveUserFlowsMutation.mutateAsync(acceptedWarnings);
                }}
                variant="secondary"
              >
                Approve User Flows
              </Button>
            </div>
            {approveUserFlowsMutation.error ? (
              <Alert tone="error" className="mt-4">
                {approveUserFlowsMutation.error.message}
              </Alert>
            ) : null}
          </Card>
          <Card surface="panel">
            <p className="font-semibold tracking-tight">Add User Flow</p>
            <form
              className="mt-4 grid gap-4"
          onSubmit={handleSubmit(async (values) => {
            await createUserFlowMutation.mutateAsync({
              acceptanceCriteria: values.acceptanceCriteria
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean),
              coverageTags: values.coverageTags
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
              doneCriteriaRefs: ["manual"],
              endState: values.endState,
              entryPoint: values.entryPoint,
              flowSteps: values.flowSteps
                .split("\n")
                .map((value) => value.trim())
                .filter(Boolean),
              source: "manual",
              title: values.title,
              userStory: values.userStory,
            });
            reset();
          })}
            >
              <div className="space-y-2">
            <Label htmlFor="flow-title">Title</Label>
            <Input id="flow-title" {...register("title")} />
              </div>
              <div className="space-y-2">
            <Label htmlFor="flow-story">User story</Label>
            <Textarea id="flow-story" {...register("userStory")} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="flow-entry">Entry point</Label>
              <Input id="flow-entry" {...register("entryPoint")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flow-end">End state</Label>
              <Input id="flow-end" {...register("endState")} />
            </div>
              </div>
              <div className="space-y-2">
            <Label htmlFor="flow-steps">Flow steps</Label>
            <Textarea id="flow-steps" {...register("flowSteps")} />
              </div>
              <div className="space-y-2">
            <Label htmlFor="coverage-tags">Coverage tags</Label>
            <Input id="coverage-tags" {...register("coverageTags")} />
              </div>
              <div className="space-y-2">
            <Label htmlFor="acceptance-criteria">Acceptance criteria</Label>
            <Textarea id="acceptance-criteria" {...register("acceptanceCriteria")} />
              </div>
              {createUserFlowMutation.error ? (
                <Alert tone="error">{createUserFlowMutation.error.message}</Alert>
              ) : null}
              <Button disabled={createUserFlowMutation.isPending} type="submit">
                Save User Flow
              </Button>
            </form>
          </Card>
          <div className="grid gap-4">
            {userFlowsQuery.data?.userFlows.map((flow) => (
              <Card key={flow.id} surface="panel">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold tracking-tight">{flow.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{flow.userStory}</p>
                  </div>
                  <Button
                    disabled={deleteUserFlowMutation.isPending}
                    onClick={() => {
                      void deleteUserFlowMutation.mutateAsync(flow.id);
                    }}
                    variant="ghost"
                  >
                    Archive
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
        <Card surface="rail" className="h-fit">
          <p className="font-semibold tracking-tight">Coverage Warnings</p>
          <div className="mt-4 grid gap-3">
            {userFlowsQuery.data?.coverage.warnings.map((warning) => (
              <div key={warning} className="rounded-md border border-border/80 bg-panel/76 p-3">
                <p className="text-sm text-muted-foreground">{warning}</p>
                <Button
                  className="mt-3 w-full"
                  onClick={() => {
                    setAcceptedWarnings((current) =>
                      current.includes(warning)
                        ? current.filter((item) => item !== warning)
                        : [...current, warning],
                    );
                  }}
                  variant={acceptedWarnings.includes(warning) ? "primary" : "ghost"}
                >
                  {acceptedWarnings.includes(warning) ? "Accepted" : "Accept Warning"}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
