import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { AppFrame } from "../components/templates/AppFrame.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { Alert } from "../components/ui/Alert.js";
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
        summary="Create the project record here, then move through setup, questions, overview, Product Spec, UX Spec, Technical Spec, and user flows to shape the delivery plan."
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card surface="panel">
          <form
            className="grid gap-5"
            onSubmit={handleSubmit(async (values) => {
              const project = await createProjectMutation.mutateAsync(values);
              navigate(`/projects/${project.id}/setup`);
            })}
          >
            <div className="qb-section-heading">
              <p className="qb-meta-label">Project definition</p>
              <p className="text-sm text-secondary">
                Name the project and capture the minimum context needed to begin setup and planning.
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
            <div className="flex flex-wrap gap-2 border-t border-border/80 pt-4">
              <Button disabled={createProjectMutation.isPending} type="submit">
                Create Project
              </Button>
            </div>
          </form>
        </Card>
        <Card className="h-fit" surface="rail">
          <p className="qb-meta-label">Workflow</p>
          <p className="mt-2 text-lg font-semibold tracking-[-0.02em]">What happens next</p>
          <div className="mt-4 grid gap-2">
            <div className="qb-kv">
              <p className="qb-meta-label">Step 1</p>
              <p className="text-sm text-foreground">Project setup and readiness verification</p>
            </div>
            <div className="qb-kv">
              <p className="qb-meta-label">Step 2</p>
              <p className="text-sm text-foreground">Questions, overview generation, approval</p>
            </div>
            <div className="qb-kv">
              <p className="qb-meta-label">Step 3</p>
              <p className="text-sm text-foreground">Product Spec generation, editing, approval</p>
            </div>
            <div className="qb-kv">
              <p className="qb-meta-label">Step 4</p>
              <p className="text-sm text-foreground">User-flow generation and planning contract review</p>
            </div>
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
