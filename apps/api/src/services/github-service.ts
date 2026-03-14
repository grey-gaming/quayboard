type GitHubRepoResult = {
  defaultBranch: string | null;
  repoUrl: string;
};

export const createGithubService = () => ({
  async verifyRepository(input: { owner: string; repo: string; token: string }) {
    const response = await fetch(
      `https://api.github.com/repos/${input.owner}/${input.repo}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${input.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
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
});

export type GithubService = ReturnType<typeof createGithubService>;
