type GitHubRepoResult = {
  defaultBranch: string | null;
  repoUrl: string;
};

type GitHubRepoOption = {
  defaultBranch: string | null;
  fullName: string;
  owner: string;
  repo: string;
  repoUrl: string;
};

type CreatePullRequestInput = {
  base: string;
  body: string;
  head: string;
  owner: string;
  repo: string;
  title: string;
  token: string;
};

type FindOpenPullRequestForHeadInput = {
  head: string;
  owner: string;
  repo: string;
  token: string;
};

type MergePullRequestInput = {
  method: "merge" | "rebase" | "squash";
  owner: string;
  pullNumber: number;
  repo: string;
  token: string;
};

type DeleteBranchInput = {
  branch: string;
  owner: string;
  repo: string;
  token: string;
};

type BranchExistsInput = {
  branch: string;
  owner: string;
  repo: string;
  token: string;
};

type GetCommitCiStatusInput = {
  owner: string;
  repo: string;
  token: string;
  ref: string;
};

type CommitCiFailure = {
  id: string;
  name: string;
  source: "check_run" | "commit_status";
  summary: string | null;
  detailsUrl: string | null;
};

type CommitCiCheck = {
  id: string;
  name: string;
  source: "check_run" | "commit_status";
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
  workflowName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastUpdatedAt: string | null;
};

const STALE_PENDING_CHECK_THRESHOLD_MS = 20 * 60_000;

const buildHeaders = (token: string) => ({
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
});

const buildGithubError = async (response: Response, fallbackMessage: string) => {
  let detail = "";

  try {
    const payload = (await response.json()) as { message?: string };
    detail = payload.message?.trim() ?? "";
  } catch {
    detail = "";
  }

  return new Error(detail.length > 0 ? detail : fallbackMessage);
};

const parseRepository = (payload: {
  default_branch?: string;
  full_name?: string;
  html_url?: string;
  name?: string;
  owner?: { login?: string };
}) => {
  const owner = payload.owner?.login ?? "";
  const repo = payload.name ?? "";
  const fullName =
    payload.full_name ??
    (owner && repo ? `${owner}/${repo}` : repo);

  return {
    defaultBranch: payload.default_branch ?? null,
    fullName,
    owner,
    repo,
    repoUrl: payload.html_url ?? `https://github.com/${fullName}`,
  } satisfies GitHubRepoOption;
};

const trimToNull = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const toIsoDateOrNull = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const createGithubService = () => ({
  async verifyRepository(input: { owner: string; repo: string; token: string }) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}`,
      {
        headers: buildHeaders(input.token),
      },
    );

    if (!response.ok) {
      throw new Error("GitHub repository verification failed.");
    }

    const payload = (await response.json()) as {
      default_branch?: string;
      html_url?: string;
    };

    return {
      defaultBranch: payload.default_branch ?? null,
      repoUrl: payload.html_url ?? `https://github.com/${input.owner}/${input.repo}`,
    } satisfies GitHubRepoResult;
  },

  async validatePat(input: { token: string }) {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: buildHeaders(input.token),
    });

    if (!userResponse.ok) {
      throw new Error("GitHub PAT validation failed.");
    }

    const userPayload = (await userResponse.json()) as {
      login?: string;
    };
    const repositories: GitHubRepoOption[] = [];
    let page = 1;

    for (;;) {
      const reposResponse = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=full_name`,
        {
          headers: buildHeaders(input.token),
        },
      );

      if (!reposResponse.ok) {
        throw new Error("GitHub repository listing failed.");
      }

      const payload = (await reposResponse.json()) as Array<{
        default_branch?: string;
        full_name?: string;
        html_url?: string;
        name?: string;
        owner?: { login?: string };
      }>;

      repositories.push(
        ...payload
          .map(parseRepository)
          .filter((repo) => repo.owner.length > 0 && repo.repo.length > 0),
      );

      if (payload.length < 100) {
        break;
      }

      page += 1;
    }

    repositories.sort((left, right) => left.fullName.localeCompare(right.fullName));

    return {
      viewerLogin: userPayload.login ?? null,
      repositories,
    };
  },

  async createPullRequest(input: CreatePullRequestInput) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
      {
        method: "POST",
        headers: buildHeaders(input.token),
        body: JSON.stringify({
          title: input.title,
          head: input.head,
          base: input.base,
          body: input.body,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("GitHub pull request creation failed.");
    }

    const payload = (await response.json()) as {
      html_url?: string;
    };

    return {
      url: payload.html_url ?? null,
    };
  },

  async findOpenPullRequestForHead(input: FindOpenPullRequestForHeadInput) {
    const url = new URL(
      `https://api.github.com/repos/${input.owner}/${input.repo}/pulls`,
    );
    url.searchParams.set("state", "open");
    url.searchParams.set("head", `${input.owner}:${input.head}`);

    const response = await fetch(url, {
      headers: buildHeaders(input.token),
    });

    if (!response.ok) {
      throw await buildGithubError(
        response,
        "GitHub pull request lookup failed.",
      );
    }

    const payload = (await response.json()) as Array<{
      html_url?: string;
      number?: number;
    }>;
    const pr = payload[0];

    if (!pr || typeof pr.number !== "number") {
      return null;
    }

    return {
      number: pr.number,
      url: pr.html_url ?? null,
    };
  },

  async mergePullRequest(input: MergePullRequestInput) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/merge`,
      {
        method: "PUT",
        headers: buildHeaders(input.token),
        body: JSON.stringify({
          merge_method: input.method,
        }),
      },
    );

    if (!response.ok) {
      throw await buildGithubError(response, "GitHub pull request merge failed.");
    }

    const payload = (await response.json()) as {
      merged?: boolean;
      sha?: string;
    };

    return {
      merged: payload.merged ?? false,
      sha: payload.sha ?? null,
    };
  },

  async deleteBranch(input: DeleteBranchInput) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/git/refs/heads/${encodeURIComponent(input.branch)}`,
      {
        method: "DELETE",
        headers: buildHeaders(input.token),
      },
    );

    if (response.status === 404) {
      return { deleted: false, notFound: true };
    }

    if (!response.ok) {
      throw await buildGithubError(response, "GitHub branch deletion failed.");
    }

    return { deleted: true, notFound: false };
  },

  async branchExists(input: BranchExistsInput) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}/branches/${encodeURIComponent(input.branch)}`,
      {
        headers: buildHeaders(input.token),
      },
    );

    if (response.status === 404) {
      return false;
    }

    if (!response.ok) {
      throw await buildGithubError(response, "GitHub branch lookup failed.");
    }

    return true;
  },

  async getCommitCiStatus(input: GetCommitCiStatusInput) {
    const [checksResponse, statusesResponse] = await Promise.all([
      fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/commits/${input.ref}/check-runs`,
        {
          headers: buildHeaders(input.token),
        },
      ),
      fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/commits/${input.ref}/status`,
        {
          headers: buildHeaders(input.token),
        },
      ),
    ]);

    if (!checksResponse.ok) {
      throw await buildGithubError(checksResponse, "GitHub check run lookup failed.");
    }

    if (!statusesResponse.ok) {
      throw await buildGithubError(statusesResponse, "GitHub commit status lookup failed.");
    }

    const checksPayload = (await checksResponse.json()) as {
      check_runs?: Array<{
        id?: number;
        name?: string;
        html_url?: string;
        started_at?: string;
        completed_at?: string;
        updated_at?: string;
        status?: string;
        conclusion?: string | null;
        details_url?: string;
        workflow_name?: string;
        output?: {
          title?: string;
          summary?: string;
          text?: string;
        };
      }>;
    };
    const statusesPayload = (await statusesResponse.json()) as {
      statuses?: Array<{
        id?: number;
        context?: string;
        description?: string;
        state?: string;
        target_url?: string | null;
        created_at?: string;
        updated_at?: string;
      }>;
    };

    const checkRuns = checksPayload.check_runs ?? [];
    const commitStatuses = statusesPayload.statuses ?? [];
    const checks: CommitCiCheck[] = [];
    const failures: CommitCiFailure[] = [];
    let pending = 0;
    let passing = 0;
    let failing = 0;

    for (const run of checkRuns) {
      const status = run.status ?? "";
      const conclusion = run.conclusion ?? null;
      const checkId = typeof run.id === "number" ? String(run.id) : run.name ?? `check-${checks.length + 1}`;
      const detailsUrl = run.details_url ?? run.html_url ?? null;
      checks.push({
        id: checkId,
        name: run.name ?? "Unnamed check run",
        source: "check_run",
        status,
        conclusion,
        detailsUrl,
        workflowName: trimToNull(run.workflow_name),
        startedAt: toIsoDateOrNull(run.started_at),
        completedAt: toIsoDateOrNull(run.completed_at),
        lastUpdatedAt: toIsoDateOrNull(run.updated_at) ?? toIsoDateOrNull(run.started_at),
      });

      if (status !== "completed") {
        pending += 1;
        continue;
      }

      if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") {
        passing += 1;
        continue;
      }

      const runId = typeof run.id === "number" ? run.id : null;
      let summary =
        trimToNull(run.output?.summary) ??
        trimToNull(run.output?.text) ??
        trimToNull(run.output?.title);

      if (!summary && runId) {
        const detailResponse = await fetch(
          `https://api.github.com/repos/${input.owner}/${input.repo}/check-runs/${runId}`,
          {
            headers: buildHeaders(input.token),
          },
        );
        if (detailResponse.ok) {
          const detailPayload = (await detailResponse.json()) as {
            output?: { title?: string; summary?: string; text?: string };
            html_url?: string;
            details_url?: string;
          };
          summary =
            trimToNull(detailPayload.output?.summary) ??
            trimToNull(detailPayload.output?.text) ??
            trimToNull(detailPayload.output?.title);
          run.html_url = run.html_url ?? detailPayload.html_url;
          run.details_url = run.details_url ?? detailPayload.details_url;
        }
      }

      failing += 1;
      failures.push({
        id: checkId,
        name: run.name ?? "Unnamed check run",
        source: "check_run",
        summary,
        detailsUrl,
      });
    }

    for (const status of commitStatuses) {
      const state = status.state ?? "";
      checks.push({
        id: typeof status.id === "number" ? String(status.id) : status.context ?? `status-${checks.length + 1}`,
        name: status.context ?? "Unnamed commit status",
        source: "commit_status",
        status: state,
        conclusion:
          state === "success"
            ? "success"
            : state === "pending"
              ? null
              : state.length > 0
                ? state
                : null,
        detailsUrl: status.target_url ?? null,
        workflowName: null,
        startedAt: toIsoDateOrNull(status.created_at),
        completedAt: state === "pending" ? null : toIsoDateOrNull(status.updated_at ?? status.created_at),
        lastUpdatedAt: toIsoDateOrNull(status.updated_at ?? status.created_at),
      });

      if (status.state === "pending") {
        pending += 1;
        continue;
      }

      if (status.state === "success") {
        passing += 1;
        continue;
      }

      if (status.state === "error" || status.state === "failure") {
        failing += 1;
        failures.push({
          id: typeof status.id === "number" ? String(status.id) : status.context ?? `status-${failures.length + 1}`,
          name: status.context ?? "Unnamed commit status",
          source: "commit_status",
          summary: trimToNull(status.description),
          detailsUrl: status.target_url ?? null,
        });
      }
    }

    const total = pending + passing + failing;
    const state: "no_ci" | "failing" | "pending" | "passing" =
      total === 0
        ? "no_ci"
        : failing > 0
          ? "failing"
          : pending > 0
            ? "pending"
            : "passing";

    const now = Date.now();
    const pendingChecks = checks.filter((check) => check.status !== "completed" && check.status !== "success");
    const isStale =
      state === "pending" &&
      pendingChecks.length > 0 &&
      pendingChecks.every((check) => {
        const updatedAtValue = check.lastUpdatedAt ?? check.startedAt;
        if (!updatedAtValue) {
          return false;
        }

        return now - new Date(updatedAtValue).getTime() >= STALE_PENDING_CHECK_THRESHOLD_MS;
      });

    return {
      ref: input.ref,
      total,
      pending,
      passing,
      failing,
      state,
      isStale,
      checks,
      failures,
    };
  },
});

export type GithubService = ReturnType<typeof createGithubService>;
