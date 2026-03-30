import type { PhaseGatesResponse } from "@quayboard/shared";
import { Link } from "react-router-dom";

import { Badge } from "../ui/Badge.js";

const KEY_TO_PATH: Record<string, string> = {
  questionnaire: "/questions",
  setup_completed: "/settings",
  overview: "/one-pager",
  overview_approved: "/one-pager",
  product_spec: "/product-spec",
  product_spec_approved: "/product-spec",
  ux_decision_tiles: "/ux-spec",
  ux_decision_selections: "/ux-spec",
  ux_decision_acceptance: "/ux-spec",
  ux_spec_generated: "/ux-spec",
  ux_approved: "/ux-spec",
  tech_decision_tiles: "/technical-spec",
  tech_decision_selections: "/technical-spec",
  tech_decision_acceptance: "/technical-spec",
  tech_spec_generated: "/technical-spec",
  tech_approved: "/technical-spec",
  technical_spec_approved: "/technical-spec",
  flows_exist: "/user-flows",
  flows_approved: "/user-flows",
  user_flows_approved: "/user-flows",
  user_flow_count: "/user-flows",
  user_flow_coverage_gaps: "/user-flows",
  milestones_exist: "/milestones",
  milestone_approved: "/milestones",
  milestone_count: "/milestones",
  milestone_document_count: "/milestones",
  milestone_approved_count: "/milestones",
  milestone_reconciled_count: "/milestones",
  features_exist: "/features",
  feature_product_approved: "/features",
  feature_count: "/features",
  feature_task_count: "/features",
};

export const PhaseGateChecklist = ({
  phases,
  projectId,
}: {
  phases: PhaseGatesResponse["phases"];
  projectId: string;
}) => (
  <div className="grid gap-3 lg:grid-cols-2">
    {phases.map((phase) => (
      <div key={phase.phase} className="border border-border/80 bg-panel-inset p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium tracking-[-0.02em]">{phase.phase}</p>
          <Badge tone={phase.items.every((item) => item.passed) ? "success" : "warning"}>
            {phase.items.filter((item) => item.passed).length}/{phase.items.length}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {phase.items.map((item) => {
            const path = KEY_TO_PATH[item.key];
            const label = path ? (
              <Link
                to={`/projects/${projectId}${path}`}
                className="hover:text-accent hover:underline transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            );

            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-sm"
              >
                {label}
                <span className={item.passed ? "text-success" : "text-muted-foreground"}>
                  {item.passed ? "passed" : "pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    ))}
  </div>
);
