import {
  GITHUB_REPO_NAME,
  GITHUB_REPO_OWNER,
} from "@/features/landing/lib/github";
import { cacheLife, cacheTag } from "next/cache";
import { logger } from "@/shared/lib/logger";

const GITHUB_REPO_API_URL = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
const GITHUB_STARS_REVALIDATE_SECONDS = 60 * 60;
const githubStarsLogger = logger.withScope("getGitHubStarsCount");

type GitHubRepositoryResponse = {
  stargazers_count?: number;
};

/**
 * Public star count for the landing header. At runtime a failed lookup
 * rethrows so a failed background refresh never replaces the last good cached
 * count with zero; the uncached wrapper only falls back to zero when nothing
 * is cached yet (cold start). During build-time prerendering the failure is
 * tolerated with a short-lived zero entry so deploys still succeed while
 * GitHub is unreachable.
 */
export async function getGitHubStarsCount(): Promise<number> {
  try {
    return await getCachedGitHubStarsCount();
  } catch (error) {
    githubStarsLogger.warn("Serving fallback star count", { error });
    return 0;
  }
}

async function getCachedGitHubStarsCount(): Promise<number> {
  "use cache";
  cacheLife("days");
  cacheTag("github-stars");

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
      throw new Error(`GitHub stars request failed (${response.status})`);
    }

    const data = (await response.json()) as GitHubRepositoryResponse;
    const stars = data.stargazers_count;

    if (typeof stars !== "number" || !Number.isFinite(stars)) {
      githubStarsLogger.warn(
        "GitHub response did not include a valid star count"
      );
      throw new Error("GitHub stars response missing stargazers_count");
    }

    return stars;
  } catch (error) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      cacheLife({ stale: 60, revalidate: 60, expire: 300 });
      return 0;
    }
    throw error;
  }
}
