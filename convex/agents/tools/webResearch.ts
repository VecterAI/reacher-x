"use node";

import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";

import { BLOG_DEMO_IDS } from "../../../features/blog/lib/blogDemoCatalog";
import {
  createBlogCardArtifact,
  createBlogDemoArtifact,
} from "../../../shared/lib/json-render/agentArtifacts";
import {
  readWebPages,
  searchReacherXBlog,
  searchWeb,
  type WebPageReadOutcome,
  type ResearchProviderContext,
} from "../../lib/researchCore";
import {
  getReacherXBlogSlug,
  isHttpUrl,
  isReacherXUrl,
} from "../../lib/webResearchCore";

const httpUrlSchema = z
  .string()
  .url()
  .refine(isHttpUrl, "URL must use http or https");

const showArticleSchema = z
  .object({
    operation: z.literal("show"),
    resourceType: z.literal("article"),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i)
      .transform((slug) => slug.toLowerCase()),
    sourceUrl: httpUrlSchema,
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(280).optional(),
  })
  .superRefine((value, context) => {
    if (value.sourceUrl && !isReacherXUrl(value.sourceUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceUrl"],
        message: "Article cards are only available for ReacherX sources",
      });
    }

    if (
      value.sourceUrl &&
      getReacherXBlogSlug(value.sourceUrl) !== value.slug
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["slug"],
        message: "The article slug must match sourceUrl",
      });
    }
  });

const showDemoSchema = z.object({
  operation: z.literal("show"),
  resourceType: z.literal("demo"),
  demoId: z.enum(BLOG_DEMO_IDS),
  sourceUrl: httpUrlSchema.refine(
    isReacherXUrl,
    "Interactive demos are only available for ReacherX sources"
  ),
  title: z.string().trim().min(1).max(120).optional(),
  caption: z.string().trim().min(1).max(280).optional(),
  sceneRange: z
    .tuple([z.number().int().min(0), z.number().int().min(0)])
    .refine(([start, end]) => start <= end, "sceneRange start must be <= end")
    .optional(),
});

const webResearchInputSchema = z.union([
  z.object({
    operation: z.literal("search"),
    query: z.string().trim().min(2).max(240),
    scope: z.enum(["web", "reacherx"]).default("web"),
    limit: z.number().int().min(1).max(4).default(3),
  }),
  z.object({
    operation: z.literal("read"),
    url: httpUrlSchema,
  }),
  showArticleSchema,
  showDemoSchema,
]);

type WebResearchInput = z.infer<typeof webResearchInputSchema>;

type WebResearchResult = {
  success: boolean;
  operation: WebResearchInput["operation"];
  query?: string;
  results?: Array<{
    title: string;
    url: string;
    publishedDate?: string;
    snippet: string;
    resource?: { type: "article"; slug: string; url: string };
  }>;
  page?: WebPageReadOutcome & {
    resource?: { type: "article"; slug: string; url: string };
  };
  artifact?: ReturnType<
    typeof createBlogCardArtifact | typeof createBlogDemoArtifact
  >;
  error?: string;
};

function getProviderContext(ctx: ToolCtx): ResearchProviderContext {
  return {
    ctx: ctx as ResearchProviderContext["ctx"],
    consumer: "agents.webResearch",
  };
}

function getResourceReference(url: string) {
  const slug = getReacherXBlogSlug(url);
  return slug ? { type: "article" as const, slug, url } : undefined;
}

export function getWebResearchModelOutput(output: WebResearchResult) {
  // Keep the model payload bounded while retaining the metadata-only artifact
  // reference needed to render the resource when the saved thread is loaded.
  // The artifact contains a component spec, never the article HTML or demo
  // markup.
  const value = JSON.parse(
    JSON.stringify({
      success: output.success,
      operation: output.operation,
      query: output.query,
      results: output.results?.map(
        ({ title, url, publishedDate, snippet, resource }) => ({
          title,
          url,
          publishedDate,
          snippet,
          resource,
        })
      ),
      page: output.page
        ? {
            title: output.page.title,
            url: output.page.url,
            snippet: output.page.snippet,
            author: output.page.author,
            error: output.page.error,
            resource: output.page.resource,
          }
        : undefined,
      artifact: output.artifact,
      error: output.error,
    })
  );

  return {
    type: "json" as const,
    value,
  };
}

export const webResearch = createTool({
  description:
    "Search the web or read a specific URL using bounded excerpts. Use show only for a ReacherX article or interactive demo that informed the answer or that the user explicitly requested.",
  inputSchema: webResearchInputSchema,
  execute: async (ctx, input): Promise<WebResearchResult> => {
    const providerContext = getProviderContext(ctx);

    if (input.operation === "search") {
      try {
        const findings =
          input.scope === "reacherx"
            ? await searchReacherXBlog(input.query, providerContext, {
                maxResults: input.limit,
                maxCharacters: 1200,
              })
            : await searchWeb(input.query, providerContext, {
                maxResults: input.limit,
                maxCharacters: 1200,
              });

        return {
          success: true,
          operation: input.operation,
          query: input.query,
          results: findings.map((finding) => ({
            ...finding,
            resource: getResourceReference(finding.url),
          })),
        };
      } catch (error) {
        return {
          success: false,
          operation: input.operation,
          query: input.query,
          error: error instanceof Error ? error.message : "Web search failed",
        };
      }
    }

    if (input.operation === "read") {
      try {
        const [page] = await readWebPages([input.url], providerContext);
        return {
          success: !page?.error,
          operation: input.operation,
          page: page
            ? { ...page, resource: getResourceReference(page.url) }
            : undefined,
          error: page?.error,
        };
      } catch (error) {
        return {
          success: false,
          operation: input.operation,
          error: error instanceof Error ? error.message : "Unable to read URL",
        };
      }
    }

    if (input.resourceType === "article") {
      return {
        success: true,
        operation: input.operation,
        artifact: createBlogCardArtifact({
          slug: input.slug,
          title: input.title,
          description: input.description,
          sourceUrl: input.sourceUrl,
        }),
      };
    }

    if (input.sourceUrl && !isReacherXUrl(input.sourceUrl)) {
      return {
        success: false,
        operation: input.operation,
        error: "Interactive demos are only available for ReacherX sources",
      };
    }

    return {
      success: true,
      operation: input.operation,
      artifact: createBlogDemoArtifact({
        scenario: input.demoId,
        title: input.title ?? "Interactive walkthrough",
        caption: input.caption ?? "Explore this workflow in ReacherX.",
        sceneRange: input.sceneRange,
        sourceUrl: input.sourceUrl,
      }),
    };
  },
  toModelOutput: (_ctx, { output }) => getWebResearchModelOutput(output),
});
