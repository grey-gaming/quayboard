import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PageIntro } from "../components/composites/PageIntro.js";
import { buildSettingsTertiaryItems } from "../components/layout/project-navigation.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { ProjectPageFrame } from "../components/templates/ProjectPageFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import {
  useDeleteProjectMutation,
  useProjectQuery,
} from "../hooks/use-projects.js";

export const DeleteProjectPage = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const projectQuery = useProjectQuery(id);
  const deleteProjectMutation = useDeleteProjectMutation(id);

  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  if (projectQuery.isLoading) {
    return (
      <AppFrame>
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      </AppFrame>
    );
  }

  if (!projectQuery.data) {
    return (
      <AppFrame>
        <p className="text-sm text-secondary">Project not found.</p>
      </AppFrame>
    );
  }

  const project = projectQuery.data;
  const nameMatches = confirmText === project.name;

  const handleDelete = async () => {
    await deleteProjectMutation.mutateAsync();
    navigate("/");
  };

  return (
    <ProjectPageFrame
      activeSection="settings"
      project={project}
      tertiaryItems={buildSettingsTertiaryItems(project)}
    >
      <PageIntro
        eyebrow="Project"
        title="Delete Project"
        summary="Permanently delete this project and all associated data. This action cannot be undone."
      />

      <Card surface="panel">
        <div className="grid gap-5">
          <Alert tone="error">
            Deleting this project is permanent and cannot be undone. All project
            data including specs, features, milestones, and job history will be
            permanently destroyed.
          </Alert>

          {!showConfirmation ? (
            <div>
              <Button
                onClick={() => setShowConfirmation(true)}
                variant="danger"
              >
                Delete This Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 border-t border-border/80 pt-4">
              <Alert tone="error">
                This is your final confirmation. Once deleted, there is no way to
                recover this project or any of its data.
              </Alert>

              <div className="grid gap-2">
                <Label htmlFor="confirm-name">
                  To confirm, type the project name{" "}
                  <code className="border border-border/80 bg-panel-inset px-1.5 py-0.5 font-mono text-xs">
                    {project.name}
                  </code>{" "}
                  below:
                </Label>
                <Input
                  autoComplete="off"
                  id="confirm-name"
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={project.name}
                  value={confirmText}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  disabled={!nameMatches || deleteProjectMutation.isPending}
                  onClick={handleDelete}
                  variant="danger"
                >
                  {deleteProjectMutation.isPending
                    ? "Deleting..."
                    : "Permanently Delete Project"}
                </Button>
                <Button
                  disabled={deleteProjectMutation.isPending}
                  onClick={() => {
                    setShowConfirmation(false);
                    setConfirmText("");
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>

              {deleteProjectMutation.isError ? (
                <Alert tone="error">
                  Failed to delete project. Please try again.
                </Alert>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </ProjectPageFrame>
  );
};
