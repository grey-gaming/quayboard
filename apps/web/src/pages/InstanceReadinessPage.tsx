import { AppFrame } from "../components/templates/AppFrame.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { useSystemReadinessQuery } from "../hooks/use-projects.js";

export const InstanceReadinessPage = () => {
  const readinessQuery = useSystemReadinessQuery();
  const passCount =
    readinessQuery.data?.checks.filter((check) => check.status === "pass").length ?? 0;
  const totalCount = readinessQuery.data?.checks.length ?? 0;

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Setup"
        title="Instance Readiness"
        summary="Check the deployment prerequisites that must be healthy before project onboarding."
        meta={
          <>
            <Badge tone="neutral">deployment checks</Badge>
            <Badge tone={passCount === totalCount && totalCount > 0 ? "success" : "warning"}>
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
                  {passCount === totalCount && totalCount > 0 ? "Ready for onboarding" : "Needs remediation"}
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
              <Badge tone={passCount === totalCount && totalCount > 0 ? "success" : "warning"}>
                live status
              </Badge>
            </div>
            <div className="mt-4 grid gap-0 border border-border/80">
              {readinessQuery.data?.checks.map((check) => (
                <div
                  key={check.key}
                  className="grid gap-3 border-t border-border/80 bg-panel-inset px-4 py-4 first:border-t-0 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <p className="text-base font-semibold tracking-[-0.02em]">{check.label}</p>
                    <p className="mt-2 text-sm text-secondary">{check.message}</p>
                  </div>
                  <div className="flex items-start md:justify-end">
                    <Badge
                      tone={
                        check.status === "pass"
                          ? "success"
                          : check.status === "warn"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {check.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </AppFrame>
  );
};
