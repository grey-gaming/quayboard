import { AppFrame } from "../components/templates/AppFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { ReadinessChecksList } from "../components/workflow/ReadinessChecksList.js";
import {
  isSystemReadinessReady,
  useSystemReadinessQuery,
} from "../hooks/use-system-readiness.js";

export const InstanceReadinessPage = () => {
  const readinessQuery = useSystemReadinessQuery();
  const passCount =
    readinessQuery.data?.checks.filter((check) => check.status === "pass").length ?? 0;
  const totalCount = readinessQuery.data?.checks.length ?? 0;
  const isReady = isSystemReadinessReady(readinessQuery.data);

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Setup"
        title="Instance Readiness"
        summary="Check the deployment prerequisites here before anyone signs in. Fix any failing checks first so project onboarding can continue without setup blockers."
        meta={
          <>
            <Badge tone="neutral">deployment checks</Badge>
            <Badge tone={isReady ? "success" : "warning"}>
              {passCount}/{totalCount || 0} passing
            </Badge>
          </>
        }
      />
      {readinessQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Card className="h-fit" surface="rail">
            <p className="qb-meta-label">Readiness summary</p>
            <div className="mt-4 grid gap-2">
              <div className="qb-kv">
                <p className="qb-meta-label">Passing checks</p>
                <p className="text-lg font-semibold text-foreground">
                  {passCount}/{totalCount || 0}
                </p>
              </div>
              <div className="qb-kv">
                <p className="qb-meta-label">Blocking posture</p>
                <p className="text-sm text-foreground">
                  {isReady ? "Ready for onboarding" : "Needs remediation"}
                </p>
              </div>
            </div>
          </Card>
          <Card surface="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
              <div>
                <p className="qb-meta-label">Checks</p>
                <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Deployment prerequisites</p>
              </div>
              <Badge tone={isReady ? "success" : "warning"}>
                {isReady ? "ready" : "blocked"}
              </Badge>
            </div>
            {readinessQuery.error ? (
              <Alert className="mt-4" tone="error">
                {readinessQuery.error.message}
              </Alert>
            ) : readinessQuery.data ? (
              <div className="mt-4">
                <ReadinessChecksList checks={readinessQuery.data.checks} />
              </div>
            ) : null}
          </Card>
        </div>
      )}
    </AppFrame>
  );
};
