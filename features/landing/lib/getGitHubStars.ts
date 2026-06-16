import {
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
} from "@/features/landing/lib/github";
import { logger } from "@/shared/lib/logger";

const GITHUB_REPO_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
const GITHUB_STARS_REVALIDATE_SECONDS = 60 * 60;
const githubStarsLogger = logger.withScope("getGitHubStarsCount");

type GitHubRepositoryResponse = {
  stargazers_count?: number;
};

export async function getGitHubStarsCount(): Promise<number> {
  "use cache";

  try {
    const response = await fetch(GITHUB_REPO_API_URL, {
      cache: "force-cache",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: {
        revalidate: GITHUB_STARS_REVALIDATE_SECONDS,
        tags: ["github-stars"],
      },
    });

    if (!response.ok) {
      githubStarsLogger.warn("Failed to fetch GitHub stars", {
        status: response.status,
        statusText: response.statusText,
      });
      return 0;
    }

    const data = (await response.json()) as GitHubRepositoryResponse;
    const stars = data.stargazers_count;

    if (typeof stars !== "number" || !Number.isFinite(stars)) {
      githubStarsLogger.warn(
        "GitHub response did not include a valid star count"
      );
      return 0;
    }

    return stars;
  } catch (error) {
    githubStarsLogger.error("Unexpected error fetching stars", {
      error,
    });
    return 0;
  }
}
