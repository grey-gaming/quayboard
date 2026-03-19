import type { ReadinessCheck } from "@quayboard/shared";

import { Badge } from "../ui/Badge.js";

type ReadinessChecksListProps = {
  checks: ReadinessCheck[];
};

export const ReadinessChecksList = ({ checks }: ReadinessChecksListProps) => (
  <div className="grid gap-0 border border-border/80">
    {checks.map((check) => (
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
);
