import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";

import { EditableMarkdownDocument } from "../components/composites/EditableMarkdownDocument.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { ProjectSubNav } from "../components/layout/ProjectSubNav.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import {
  findLatestJob,
  getDefaultJobFailureHint,
  getJobErrorMessage,
  LatestJobFailureAlert,
} from "../components/workflow/LatestJobFailureAlert.js";
import { Alert } from "../components/ui/Alert.js";
import { AiWorkflowButton } from "../components/ui/AiWorkflowButton.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import {
  useApproveProductSpecMutation,
  useGenerateProductSpecMutation,
  useProjectQuery,
  useProductSpecQuery,
  useProductSpecVersionsQuery,
  useProjectJobsQuery,
  useRestoreProductSpecMutation,
  useUpdateProductSpecMutation,
} from "../hooks/use-projects.js";
import { useSseEvents } from "../hooks/use-sse-events.js";
import { formatDateTime } from "../lib/format.js";

const productSpecJobTypes = new Set([
  "GenerateProductSpec",
  "RegenerateProductSpec",
  "GenerateProductSpecImprovements",
]);

export const ProductSpecPage = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const projectQuery = useProjectQuery(id);
  const productSpecQuery = useProductSpecQuery(id);
  const versionsQuery = useProductSpecVersionsQuery(id);
  const jobsQuery = useProjectJobsQuery(id);
  const generateProductSpecMutation = useGenerateProductSpecMutation(id);
  const approveProductSpecMutation = useApproveProductSpecMutation(id);
  const restoreProductSpecMutation = useRestoreProductSpecMutation(id);
  const updateProductSpecMutation = useUpdateProductSpecMutation(id);

  useSseEvents(id);

  const activeProductSpecJob = useMemo(
    () =>
      jobsQuery.data?.jobs.find(
        (job) =>
          productSpecJobTypes.has(job.type) &&
          (job.status === "queued" || job.status === "running"),
      ) ?? null,
    [jobsQuery.data?.jobs],
  );
  const latestProductSpecJob = useMemo(
    () => findLatestJob(jobsQuery.data?.jobs, (job) => productSpecJobTypes.has(job.type)),
    [jobsQuery.data?.jobs],
  );
  const latestFailedProductSpecJob = useMemo(
    () =>
      findLatestJob(
        jobsQuery.data?.jobs,
        (job) =>
          productSpecJobTypes.has(job.type) &&
          (job.status === "failed" || job.status === "cancelled"),
      ),
    [jobsQuery.data?.jobs],
  );
  const redirectedFromLockedSection =
    typeof location.state === "object" &&
    location.state !== null &&
    "lockedFromPath" in location.state &&
    typeof location.state.lockedFromPath === "string"
      ? location.state.lockedFromPath
      : null;
  const generationMode = productSpecQuery.data?.productSpec ? "regenerate" : "generate";
  const activeError =
    productSpecQuery.error ||
    versionsQuery.error ||
    jobsQuery.error ||
    generateProductSpecMutation.error ||
    approveProductSpecMutation.error ||
    restoreProductSpecMutation.error ||
    updateProductSpecMutation.error;
  const productSpecButtonActive =
    generateProductSpecMutation.isPending || Boolean(activeProductSpecJob);

  return (
    <AppFrame>
      {projectQuery.data ? (
        <ProjectSubNav project={projectQuery.data} />
      ) : null}
      <PageIntro
        eyebrow="Product Spec"
        title="Generated Product Spec"
        summary="This page expands the approved overview into the working Product Spec. Review it, refine it, inspect version history, and approve the version that UX specification should follow."
        meta={
          <>
            <Badge tone="success">overview approved</Badge>
            <Badge tone={productSpecQuery.data?.productSpec ? "success" : "warning"}>
              {productSpecQuery.data?.productSpec ? "Product Spec present" : "Product Spec pending"}
            </Badge>
          </>
        }
      />

      {activeError ? <Alert tone="error">{activeError.message}</Alert> : null}
      {redirectedFromLockedSection ? (
        <Alert tone="info">
          Approve the Product Spec on this page to continue to UX Spec. You were redirected
          from <span className="font-mono"> {redirectedFromLockedSection}</span>.
        </Alert>
      ) : null}
      {activeProductSpecJob ? (
        <Alert tone="info">
          Product Spec generation is {activeProductSpecJob.status}. This can take up to 10 minutes
          depending on the quality and speed of the selected model, so please be patient. The page
          will refresh automatically when the job completes.
        </Alert>
      ) : null}
      {!activeProductSpecJob ? (
        <LatestJobFailureAlert
          currentVersionStillAvailable={Boolean(productSpecQuery.data?.productSpec)}
          hint={
            latestFailedProductSpecJob && getJobErrorMessage(latestFailedProductSpecJob)
              ? getDefaultJobFailureHint(
                  getJobErrorMessage(latestFailedProductSpecJob)!,
                  "Product Spec generation",
                )
              : null
          }
          job={latestFailedProductSpecJob}
          workflowLabel="Product Spec generation"
        />
      ) : null}

      <div className="grid gap-4">
        <Card surface="panel">
          <div className="flex flex-wrap justify-end gap-2 border-b border-border/80 pb-4">
            <div className="flex flex-wrap gap-2">
              <AiWorkflowButton
                active={productSpecButtonActive}
                disabled={productSpecButtonActive}
                label={
                  productSpecQuery.data?.productSpec
                    ? "Regenerate Product Spec"
                    : "Generate Product Spec"
                }
                onClick={() => {
                  void generateProductSpecMutation.mutateAsync(generationMode);
                }}
                runningLabel="Generating Product Spec"
                type="button"
                variant="secondary"
              />
              <Button
                disabled={!productSpecQuery.data?.productSpec || approveProductSpecMutation.isPending}
                onClick={() => {
                  void approveProductSpecMutation.mutateAsync();
                }}
                type="button"
                variant="secondary"
              >
                Approve Product Spec
              </Button>
            </div>
          </div>
          <div className="mt-4 min-w-0 overflow-hidden border border-border/80 bg-panel px-4 py-4">
            {productSpecQuery.data?.productSpec ? (
              <EditableMarkdownDocument
                disabled={Boolean(activeProductSpecJob)}
                isSaving={updateProductSpecMutation.isPending}
                markdown={productSpecQuery.data.productSpec.markdown}
                onSave={(markdown) => updateProductSpecMutation.mutateAsync({ markdown })}
                saveLabel="Save Product Spec"
              />
            ) : activeProductSpecJob || latestProductSpecJob ? (
              <p className="text-sm text-secondary">
                The Product Spec is being prepared. Stay on this page to review it when the job
                finishes.
              </p>
            ) : (
              <p className="text-sm text-secondary">
                No Product Spec has been generated yet. Generate it from this screen after the
                overview is approved.
              </p>
            )}
          </div>
        </Card>

        <Card surface="rail">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
            <div>
              <p className="qb-meta-label">History</p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                Product Spec Versions
              </p>
            </div>
            <Badge tone="neutral">{versionsQuery.data?.versions.length ?? 0} versions</Badge>
          </div>
          <div className="mt-4 grid gap-0 border border-border/80">
            {versionsQuery.data?.versions.length ? (
              versionsQuery.data.versions.map((version) => (
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
                      disabled={restoreProductSpecMutation.isPending}
                      onClick={() => {
                        void restoreProductSpecMutation.mutateAsync(version.version);
                      }}
                      type="button"
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
              ))
            ) : (
              <div className="bg-panel-inset px-4 py-4 text-sm text-secondary">
                No Product Spec versions yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppFrame>
  );
};
