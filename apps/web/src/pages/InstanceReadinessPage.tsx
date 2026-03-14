import { AppFrame } from "../components/templates/AppFrame.js";
import { Card } from "../components/ui/Card.js";
import { Badge } from "../components/ui/Badge.js";
import { Spinner } from "../components/ui/Spinner.js";
import { PageIntro } from "../components/composites/PageIntro.js";
import { useSystemReadinessQuery } from "../hooks/use-projects.js";

export const InstanceReadinessPage = () => {
  const readinessQuery = useSystemReadinessQuery();

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Setup"
        title="Instance Readiness"
        summary="Check the deployment prerequisites that must be healthy before project onboarding."
      />
      {readinessQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid gap-4">
          {readinessQuery.data?.checks.map((check) => (
            <Card key={check.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{check.label}</p>
                <p className="text-sm text-muted-foreground">{check.message}</p>
              </div>
              <Badge tone={check.status === "pass" ? "success" : "warning"}>
                {check.status}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </AppFrame>
  );
};
