import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import {
  parseBlogPost,
  blogBodyMarkdown,
} from "../features/blog/lib/blogContentCore";
import { getBlogPosts } from "../features/blog/lib/blogPosts";
import {
  getRelatedBlogPosts,
  filterBlogPosts,
  BLOG_CATEGORIES,
} from "../features/blog/lib/blogHelpers";

const historical = new Map([
  ["reacherx-v3-public-beta", "2025-10-13"],
  ["why-finding-customers-is-hard", "2025-03-22"],
  ["finding-customers-should-be-easier", "2025-03-18"],
]);

test("launch collection preserves history, removes samples, and has unique dates", async () => {
  const files = await readdir("content/blog");
  const all = await Promise.all(
    files
      .filter((file) => file.endsWith(".mdx"))
      .map(async (file) =>
        parseBlogPost(
          await readFile(`content/blog/${file}`, "utf8"),
          file.slice(0, -4)
        )
      )
  );
  for (const post of all) assert.notEqual(post.category, "demo-content");
  assert.ok(files.every((file) => !file.startsWith("example-")));
  for (const file of [
    "authoring-example.mdx",
    "welcome-to-the-reacherx-blog.mdx",
    "write-a-better-targeting-brief.mdx",
    "explore-the-reacherx-codebase.mdx",
  ])
    assert.ok(!files.includes(file), file);
  const real = all;
  assert.equal(real.length, 59);
  assert.equal(new Set(real.map((post) => post.date)).size, real.length);
  assert.ok(real.every((post) => !post.draft));
  for (const [slug, date] of historical)
    assert.equal(real.find((post) => post.slug === slug)?.date, date);
  assert.equal(
    real.find((post) => post.slug === "introducing-reacherx-v4")?.date,
    "2026-06-29"
  );
  assert.equal(BLOG_CATEGORIES.length, 6);
  assert.equal(
    BLOG_CATEGORIES.find((item) => item.slug === "perspectives")?.label,
    "Founder Notes"
  );
});

test("every real article has two valid curated destinations and working internal article anchors", async () => {
  const posts = await getBlogPosts();
  for (const post of posts) {
    assert.equal(post.related.length, 2, post.slug);
    assert.equal(new Set(post.related).size, 2, post.slug);
    assert.deepEqual(
      getRelatedBlogPosts(post, posts).map((item) => item.slug),
      post.related
    );
    for (const slug of post.related) {
      assert.notEqual(slug, post.slug);
      assert.ok(
        posts.some((item) => item.slug === slug),
        `${post.slug}: ${slug}`
      );
    }
    for (const [, slug, fragment] of post.content.matchAll(
      /\]\(\/blog\/([a-z0-9-]+)(?:#([a-z0-9-]+))?\)/g
    )) {
      const target = posts.find((item) => item.slug === slug);
      assert.ok(target, `${post.slug}: missing ${slug}`);
      if (fragment)
        assert.ok(
          target.headings.some((heading) => heading.id === fragment),
          fragment
        );
    }
  }
});

test("Explore falls back safely for missing, duplicate, self, and deleted references", async () => {
  const posts = await getBlogPosts();
  const current = posts.find(
    (post) => post.slug === "introducing-reacherx-v4"
  )!;
  const other = posts.find((post) => post.slug === "find-candidates")!;
  const broken = {
    ...current,
    related: [
      current.slug,
      "absent",
      "example-field-note",
      other.slug,
      other.slug,
    ],
  };
  const related = getRelatedBlogPosts(broken, posts);
  assert.equal(related.length, 2);
  assert.equal(related[0].slug, other.slug);
  assert.equal(new Set(related.map((post) => post.slug)).size, 2);
  assert.ok(related.every((post) => post.slug !== current.slug));
  assert.deepEqual(getRelatedBlogPosts(current, [current]), []);
});

test("new prose is complete, contains no em dashes, and exposes readable placeholders in Markdown", async () => {
  const posts = (await getBlogPosts()).filter(
    (post) => !historical.has(post.slug)
  );
  assert.equal(posts.length, 56);
  for (const post of posts) {
    assert.doesNotMatch(
      post.title + post.description + post.content,
      /\u2014|&mdash;|&#(?:8212|x2014);/i,
      post.slug
    );
    assert.doesNotMatch(post.content, /lorem ipsum|TODO|TBD/i, post.slug);
    assert.ok(post.headings.length >= 3, post.slug);
    const markdown = blogBodyMarkdown(post.content);
    assert.ok(markdown.split(/\s+/).length >= 300, post.slug);
    assert.doesNotMatch(
      markdown,
      /<BlogCallout|<BlogMediaPlaceholder|undefined/,
      post.slug
    );
    if (post.content.includes("BlogMediaPlaceholder")) {
      assert.match(markdown, /\*\*Media placeholder:/, post.slug);
      assert.doesNotMatch(
        post.content,
        /src=["'][^"']*(?:placeholder|missing)/,
        post.slug
      );
    }
    assert.ok(post.updated && post.updated >= "2026-09-10", post.slug);
  }
});

test("comparisons attribute current sources and funding links to the supplied Patreon page", async () => {
  const posts = await getBlogPosts();
  for (const post of posts.filter((post) => post.category === "comparisons")) {
    assert.match(post.content, /September 10, 2026/);
    assert.match(post.content, /beta/);
    assert.match(post.content, /\]\(\/pricing\)/);
  }
  for (const slug of ["support-reacherx", "why-i-open-sourced-reacherx"]) {
    assert.match(
      posts.find((post) => post.slug === slug)!.content,
      /https:\/\/www\.patreon\.com\/cw\/ReacherX/
    );
  }
});

test("reader and contributor Explore paths keep the intended next step", async () => {
  const posts = await getBlogPosts();
  const paths = [
    [
      "compare-reacherx-alternatives",
      "manage-people-with-reacherx",
      "teach-reacherx-what-you-want",
    ],
    [
      "how-reacherx-adapts-to-use-cases",
      "how-reacherx-memory-works",
      "how-reacherx-reporting-works",
    ],
    [
      "introducing-reacherx-v4",
      "getting-started-with-reacherx",
      "workspaces-explained",
      "teach-reacherx-what-you-want",
      "what-reacherx-does-automatically",
      "read-your-reacherx-analytics",
      "understand-agent-observability",
    ],
    [
      "why-i-open-sourced-reacherx",
      "help-build-reacherx",
      "run-reacherx-yourself",
      "how-reacherx-agent-works",
      "how-reacherx-discovery-works",
      "how-reacherx-qualification-works",
      "how-reacherx-enrichment-works",
      "how-reacherx-planning-works",
      "how-reacherx-outreach-runs",
      "how-reacherx-memory-works",
      "how-reacherx-reporting-works",
    ],
  ];
  for (const path of paths) {
    for (let index = 0; index < path.length - 1; index++) {
      const post = posts.find((item) => item.slug === path[index])!;
      assert.equal(
        getRelatedBlogPosts(post, posts)[0]?.slug,
        path[index + 1],
        post.slug
      );
    }
  }
  for (const post of posts.filter((item) => item.category === "comparisons")) {
    assert.ok(
      getRelatedBlogPosts(post, posts).every(
        (item) => item.category !== "engineering"
      ),
      post.slug
    );
  }
});

test("media placeholders preserve title and caption without a broken asset URL", () => {
  const markdown = blogBodyMarkdown(
    '<BlogMediaPlaceholder title="Workspace switcher" caption="Show two projects &amp; their separate instructions." />'
  );
  assert.match(markdown, /\*\*Media placeholder: Workspace switcher\*\*/);
  assert.match(markdown, /Show two projects & their separate instructions\./);
  assert.doesNotMatch(markdown, /BlogMediaPlaceholder|\]\(\)/);
});

test("all 25 supplied products are covered and all 18 individual comparisons cite their own source", async () => {
  const sources: Record<string, string> = {
    salesforce: "salesforce.com",
    micro: "micro.so",
    youspot: "connect.com",
    talktohumans: "talktohumans.app",
    apollo: "apollo.io",
    clay: "clay.com",
    unify: "unifygtm.com",
    "common-room": "commonroom.io",
    origami: "origami.chat",
    gojiberry: "gojiberry.ai",
    gigamultiplier: "gigacatalyst.com",
    bond: "askbond.ai",
    traxy: "traxy.ai",
    heyreach: "heyreach.io",
    xreacher: "xreacher.com",
    phantombuster: "phantombuster.com",
    warmbly: "warmbly.com",
    nectar: "nectarsocial.com",
  };
  const posts = await getBlogPosts();
  const hub = posts.find(
    (post) => post.slug === "compare-reacherx-alternatives"
  )!;
  assert.ok(hub);
  for (const name of [
    "Salesforce",
    "Apollo",
    "Clay",
    "HeyReach",
    "GTM Arena",
    "Micro",
    "traxy",
    "Unify",
    "Koala",
    "Inflection",
    "Origami",
    "Gojiberry",
    "Gigamultiplier",
    "Gigacatalyst",
    "Common Room",
    "Warmbly",
    "Bond",
    "AskBond",
    "Nectar",
    "Nectar Social",
    "Juma",
    "Reavion",
    "Inboxapp",
    "Xreacher",
    "PhantomBuster",
    "TalkToHumans",
    "YouSpot",
    "Runable",
  ]) {
    assert.ok(
      filterBlogPosts([hub], name).some((post) => post.slug === hub.slug),
      name
    );
  }
  const linkedHosts = (content: string) =>
    [...content.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) =>
      new URL(match[1]).hostname.replace(/^www\./, "")
    );
  const hasHost = (hosts: string[], host: string) =>
    hosts.some((value) => value === host || value.endsWith(`.${host}`));
  for (const [name, host] of Object.entries(sources)) {
    const slug = `reacherx-vs-${name}`;
    const post = posts.find((item) => item.slug === slug);
    assert.ok(post, slug);
    assert.equal(post.category, "comparisons", slug);
    assert.ok(hasHost(linkedHosts(post.content), host), slug);
    assert.ok(hub.content.includes(`/blog/${slug}`), slug);
  }
  for (const host of [
    ...Object.values(sources),
    "inboxapp.com",
    "getkoala.com",
    "reavion.com",
    "gtmarena.ai",
    "inflection.io",
    "juma.ai",
    "runable.com",
  ])
    assert.ok(hasHost(linkedHosts(hub.content), host), host);
});
