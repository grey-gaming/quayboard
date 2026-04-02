import { useEffect, useState } from "react";

import { PageIntro } from "../components/composites/PageIntro.js";
import { AppFrame } from "../components/templates/AppFrame.js";
import { Alert } from "../components/ui/Alert.js";
import { Badge } from "../components/ui/Badge.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import {
  useExecutionSettingsQuery,
  useUpdateExecutionSettingsMutation,
} from "../hooks/use-sandbox.js";

export const ExecutionSettingsPage = () => {
  const executionSettingsQuery = useExecutionSettingsQuery();
  const updateMutation = useUpdateExecutionSettingsMutation();
  const [values, setValues] = useState({
    defaultImage: "",
    dockerHost: "",
    maxConcurrentRuns: "2",
    defaultTimeoutSeconds: "900",
    defaultCpuLimit: "1",
    defaultMemoryMb: "2048",
  });

  useEffect(() => {
    if (!executionSettingsQuery.data) {
      return;
    }

    setValues({
      defaultImage: executionSettingsQuery.data.defaultImage,
      dockerHost: executionSettingsQuery.data.dockerHost ?? "",
      maxConcurrentRuns: String(executionSettingsQuery.data.maxConcurrentRuns),
      defaultTimeoutSeconds: String(executionSettingsQuery.data.defaultTimeoutSeconds),
      defaultCpuLimit: String(executionSettingsQuery.data.defaultCpuLimit),
      defaultMemoryMb: String(executionSettingsQuery.data.defaultMemoryMb),
    });
  }, [executionSettingsQuery.data]);

  return (
    <AppFrame>
      <PageIntro
        eyebrow="Settings"
        title="Execution Settings"
        summary="Configure the instance defaults used by sandbox execution and managed container orchestration."
        meta={
          <>
            <Badge tone="neutral">sandbox runner</Badge>
            <Badge tone="neutral">instance scope</Badge>
          </>
        }
      />

      <Card className="max-w-4xl" surface="panel">
        {executionSettingsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4">
            {executionSettingsQuery.error ? (
              <Alert tone="error">Failed to load execution settings.</Alert>
            ) : null}
            {updateMutation.error ? (
              <Alert tone="error">Failed to save execution settings.</Alert>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="execution-image">Default image</Label>
              <Input
                id="execution-image"
                onChange={(event) =>
                  setValues((current) => ({ ...current, defaultImage: event.target.value }))
                }
                value={values.defaultImage}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="execution-docker-host">Docker host</Label>
              <Input
                id="execution-docker-host"
                onChange={(event) =>
                  setValues((current) => ({ ...current, dockerHost: event.target.value }))
                }
                placeholder="Optional override"
                value={values.dockerHost}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="execution-concurrency">Max concurrent runs</Label>
                <Input
                  id="execution-concurrency"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, maxConcurrentRuns: event.target.value }))
                  }
                  value={values.maxConcurrentRuns}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="execution-timeout">Default timeout (seconds)</Label>
                <Input
                  id="execution-timeout"
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      defaultTimeoutSeconds: event.target.value,
                    }))
                  }
                  value={values.defaultTimeoutSeconds}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="execution-cpu">Default CPU limit</Label>
                <Input
                  id="execution-cpu"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, defaultCpuLimit: event.target.value }))
                  }
                  value={values.defaultCpuLimit}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="execution-memory">Default memory (MB)</Label>
                <Input
                  id="execution-memory"
                  onChange={(event) =>
                    setValues((current) => ({ ...current, defaultMemoryMb: event.target.value }))
                  }
                  value={values.defaultMemoryMb}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    defaultImage: values.defaultImage.trim(),
                    dockerHost: values.dockerHost.trim() || null,
                    maxConcurrentRuns: Number(values.maxConcurrentRuns),
                    defaultTimeoutSeconds: Number(values.defaultTimeoutSeconds),
                    defaultCpuLimit: Number(values.defaultCpuLimit),
                    defaultMemoryMb: Number(values.defaultMemoryMb),
                  })
                }
                variant="primary"
              >
                {updateMutation.isPending ? "Saving..." : "Save settings"}
              </Button>
              <p className="text-sm text-secondary">
                These defaults apply to sandbox execution unless a project&apos;s saved sandbox
                limits override CPU, memory, timeout, or egress.
              </p>
            </div>
          </div>
        )}
      </Card>
    </AppFrame>
  );
};
