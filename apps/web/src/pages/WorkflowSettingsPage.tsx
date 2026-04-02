import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Badge } from "../components/ui/Badge.js";
import { Card } from "../components/ui/Card.js";

export const WorkflowSettingsPage = () => (
  <AppFrame>
    <PageIntro
      eyebrow="Settings"
      title="Workflow Settings"
      summary="Configure auto-advance defaults and review loop behaviour for this Quayboard instance."
      meta={
        <>
          <Badge tone="neutral">workflow</Badge>
          <Badge tone="neutral">orchestration</Badge>
        </>
      }
    />

    <div className="grid gap-4 max-w-4xl">
      <Card surface="panel">
        <p className="qb-meta-label">Auto-advance</p>
        <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">Auto-Advance Defaults</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
          These defaults are applied when starting a new auto-advance session. You can override them
          per-session from the Mission Control page.
        </p>
        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-4 border border-border/70 bg-panel-inset px-4 py-3">
            <div>
              <p className="text-sm font-medium">Default creativity mode</p>
              <p className="mt-0.5 text-xs text-secondary">
                Controls how adventurous the LLM is when generating planning artefacts.
              </p>
            </div>
            <select
              className="border border-border/70 bg-panel px-2 py-1 text-sm text-foreground"
              defaultValue="balanced"
              disabled
            >
              <option value="conservative">Conservative</option>
              <option value="balanced">Balanced</option>
              <option value="creative">Creative</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 border border-border/70 bg-panel-inset px-4 py-3">
            <div>
              <p className="text-sm font-medium">Skip review steps by default</p>
              <p className="mt-0.5 text-xs text-secondary">
                When enabled, auto-advance will skip approval gates and continue automatically.
              </p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              defaultChecked={false}
              disabled
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Persisted settings for auto-advance defaults are coming in a future update.
        </p>
      </Card>

      <Card surface="panel">
        <p className="qb-meta-label">Review loop</p>
        <p className="mt-2 text-xl font-semibold tracking-[-0.02em]">Review Loop Configuration</p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary">
          Review loop behaviour controls how auto-advance handles approval gates. By default,
          auto-advance pauses and waits for human approval at each gate.
        </p>
        <div className="mt-4 border border-border/70 bg-panel-inset px-4 py-3">
          <p className="text-sm text-secondary">
            Persisted workflow defaults are still future work. Sandbox execution is now available
            separately from the Develop surface and execution settings page.
          </p>
        </div>
      </Card>
    </div>
  </AppFrame>
);
