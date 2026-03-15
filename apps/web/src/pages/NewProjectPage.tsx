import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Textarea } from "../components/ui/Textarea.js";
import { useCreateProjectMutation } from "../hooks/use-projects.js";

type FormValues = {
  description: string;
  name: string;
};

export const NewProjectPage = () => {
  const createProjectMutation = useCreateProjectMutation();
  const navigate = useNavigate();
  const { handleSubmit, register } = useForm<FormValues>({
    defaultValues: {
      description: "",
      name: "",
    },
  });

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Projects"
        title="Create Project"
        summary="Start the scratch-path workflow that leads through setup, questionnaire, overview, and user flows."
        meta={
          <>
            <Badge tone="info">scratch path only</Badge>
            <Badge tone="warning">import deferred</Badge>
          </>
        }
      />
      <Card className="max-w-3xl" surface="rail">
        <form
          className="space-y-6"
          onSubmit={handleSubmit(async (values) => {
            const project = await createProjectMutation.mutateAsync(values);
            navigate(`/projects/${project.id}/setup`);
          })}
        >
          <div className="grid gap-2 border-b border-border/70 pb-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Project definition
            </p>
            <p className="text-sm text-muted-foreground">
              Name the project and capture enough context to start guided setup.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" {...register("name", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea id="project-description" {...register("description")} />
          </div>
          {createProjectMutation.error ? (
            <Alert tone="error">{createProjectMutation.error.message}</Alert>
          ) : null}
          <Button disabled={createProjectMutation.isPending} type="submit">
            Create Project
          </Button>
        </form>
      </Card>
    </AppFrame>
  );
};
