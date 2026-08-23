import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLinkedInCommentPreview,
  matchesLinkedInPostReference,
} from "../shared/lib/linkedin/comments";
import {
  getLinkedInResharedPost,
  normalizeLinkedInPost,
} from "../shared/lib/linkedin/post";
import {
  getWorkflowEvidencePostCreatedAt,
  sanitizeProspectEvidencePostsForWorkflow,
} from "../convex/lib/workflowSafeProspect";

test("canonical LinkedIn posts preserve their wrapper and structured mentions", () => {
  const post = normalizeLinkedInPost({
    id: "urn:li:activity:123",
    platform: "linkedin",
    url: "https://www.linkedin.com/feed/update/urn:li:activity:123/",
    author: { name: "Jane Doe" },
    text: "Jane mentioned Acme",
    createdAt: 123,
    raw: {
      textAttributes: [
        {
          text: "Acme",
          type: "companyMention",
          urn: "1035",
        },
      ],
    },
  });

  assert.equal(post?.id, "urn:li:activity:123");
  assert.equal(post?.platform, "linkedin");
  assert.equal(post?.author.name, "Jane Doe");
  assert.deepEqual(post?.raw, {
    textAttributes: [
      {
        text: "Acme",
        type: "companyMention",
        urn: "1035",
      },
    ],
  });
});

test("raw qualification-source posts receive a stable internal LinkedIn model", () => {
  const rawPost = {
    postID: "urn:li:activity:456",
    postURL: "https://www.linkedin.com/feed/update/urn:li:activity:456/",
    text: "A complete qualification source",
    author: {
      id: "person-1",
      name: "Jomel Layco",
      profilePictureURL: "https://media.licdn.com/avatar.jpg",
      url: "https://www.linkedin.com/in/jomel-layco/",
    },
    postedAt: { timestamp: 456 },
    engagements: {
      totalReactions: 7,
      commentsCount: 2,
      repostsCount: 1,
    },
  };

  const post = normalizeLinkedInPost(rawPost);

  assert.equal(post?.id, rawPost.postID);
  assert.equal(post?.url, rawPost.postURL);
  assert.equal(post?.text, rawPost.text);
  assert.equal(post?.author.name, "Jomel Layco");
  assert.equal(post?.metrics?.comments, 2);
  assert.equal(post?.raw, rawPost);
});

test("Unipile post attachments normalize into renderable LinkedIn media", () => {
  const rawPost = {
    provider: "LINKEDIN" as const,
    id: "Ux6-quoted-post",
    share_url:
      "https://www.linkedin.com/feed/update/urn:li:activity:7493715921715445760",
    text: "A rich quoted post",
    author: { name: "Muhammad Salman" },
    attachments: [
      {
        type: "image",
        url: "https://media.licdn.com/dms/image/v2/image.jpg",
        size: { width: 1200, height: 675 },
        alt_text: "Product image",
      },
      {
        type: "video",
        url: "https://media.licdn.com/dms/video/v2/video.mp4",
        preview_url: "https://media.licdn.com/dms/image/v2/video-poster.jpg",
        width: 1920,
        height: 1080,
      },
      {
        type: "gif",
        url: "https://media.licdn.com/dms/image/v2/animated.gif",
      },
      {
        type: "document",
        url: "https://www.linkedin.com/documents/reacherx-pitch-deck",
        file_name: "pitch-deck.pdf",
      },
    ],
  };

  const post = normalizeLinkedInPost(rawPost);

  assert.equal(post?.id, rawPost.id);
  assert.equal(post?.url, rawPost.share_url);
  assert.deepEqual(post?.media, [
    {
      type: "image",
      url: "https://media.licdn.com/dms/image/v2/image.jpg",
      width: 1200,
      height: 675,
      description: "Product image",
    },
    {
      type: "video",
      url: "https://media.licdn.com/dms/video/v2/video.mp4",
      width: 1920,
      height: 1080,
      posterUrl: "https://media.licdn.com/dms/image/v2/video-poster.jpg",
    },
    {
      type: "image",
      url: "https://media.licdn.com/dms/image/v2/animated.gif",
    },
    {
      type: "link",
      url: "https://www.linkedin.com/documents/reacherx-pitch-deck",
      title: "pitch-deck.pdf",
    },
  ]);
  assert.equal(post?.raw, rawPost);
});

test("LinkedIn attachment normalization retains unavailable media shells and deduplicates URLs", () => {
  const imageUrl = "https://media.licdn.com/dms/image/v2/shared-image.jpg";
  const post = normalizeLinkedInPost({
    platform: "linkedin",
    id: "urn:li:activity:7493715921715445760",
    raw: {
      attachments: [
        { type: "image", url: imageUrl },
        {
          type: "image",
          url: "https://media.licdn.com/dms/image/v2/expired-image.jpg",
          unavailable: true,
        },
        {
          type: "video",
          url: "https://media.licdn.com/dms/video/v2/failed-video.mp4",
          availability: { status: "failed" },
        },
        { type: "image", url: "javascript:alert('unsafe')" },
        {
          type: "future_attachment_type",
          url: "https://www.linkedin.com/posts/fallback-link",
        },
      ],
    },
  });

  assert.deepEqual(post?.media, [
    { type: "image", url: imageUrl },
    { type: "image", unavailable: true },
    { type: "video", unavailable: true },
    { type: "image", unavailable: true },
    {
      type: "link",
      url: "https://www.linkedin.com/posts/fallback-link",
    },
  ]);
});

test("Unipile quoted posts keep URL-less unavailable media placeholder-capable", () => {
  const post = normalizeLinkedInPost({
    provider: "LINKEDIN",
    id: "Ux6-unavailable-quoted-post",
    share_url:
      "https://www.linkedin.com/feed/update/urn:li:activity:7493715921715445760",
    attachments: [
      {
        id: "unavailable-video",
        type: "video",
        unavailable: true,
        file_name: "recording.mp4",
        alt_text: "A recording no longer supplied by LinkedIn",
      },
    ],
  });

  assert.deepEqual(post?.media, [
    {
      id: "unavailable-video",
      type: "video",
      unavailable: true,
      title: "recording.mp4",
      description: "A recording no longer supplied by LinkedIn",
    },
  ]);
  assert.equal(post?.media?.[0] && "url" in post.media[0], false);
});

test("LinkdAPI activity headers preserve the prospect's relationship to a post", () => {
  const rawPost = {
    urn: "urn:li:activity:789",
    header: "Lazar Jovanovic reposted this",
    text: "An original post from another account",
    author: {
      name: "O3",
      url: "https://www.linkedin.com/company/o3/",
    },
  };

  const post = normalizeLinkedInPost(rawPost);
  const [workflowPost] = sanitizeProspectEvidencePostsForWorkflow(
    [rawPost],
    "linkedin"
  );
  const rehydratedPost = normalizeLinkedInPost(workflowPost);

  assert.equal(post?.author.name, "O3");
  assert.equal(post?.activity?.type, "repost");
  assert.equal(post?.activity?.actor.name, "Lazar Jovanovic");
  assert.equal(rehydratedPost?.activity?.type, "repost");
  assert.equal(
    rehydratedPost?.activity?.actor.name,
    post?.activity?.actor.name
  );
});

test("LinkdAPI reaction headers normalize liked-post attribution", () => {
  const post = normalizeLinkedInPost({
    urn: "urn:li:activity:790",
    header: "Lazar Jovanovic likes this",
    text: "A liked post from another account",
    author: { name: "Another author" },
  });

  assert.equal(post?.activity?.type, "like");
  assert.equal(post?.activity?.actor.name, "Lazar Jovanovic");
});

test("reshared LinkedIn content survives workflow sanitization", () => {
  const rawPost = {
    urn: "urn:li:activity:791",
    text: "My take on this announcement",
    author: { name: "Lazar Jovanovic" },
    resharedPostContent: {
      urn: "urn:li:activity:792",
      url: "https://www.linkedin.com/feed/update/urn:li:activity:792",
      text: "The original announcement",
      author: { name: "O3" },
      postedAt: { timestamp: 792 },
    },
  };

  const [workflowPost] = sanitizeProspectEvidencePostsForWorkflow(
    [rawPost],
    "linkedin"
  );
  const resharedPost = getLinkedInResharedPost(workflowPost);

  assert.equal(resharedPost?.id, "urn:li:activity:792");
  assert.equal(resharedPost?.author.name, "O3");
  assert.equal(resharedPost?.text, "The original announcement");
});

test("LinkedIn activity ids recover missing provider timestamps", () => {
  const activityId = "7471179100469211136";
  const expectedTimestamp = 1781267905347;
  const rawPost = {
    urn: `urn:li:activity:${activityId}`,
    text: "A post whose provider timestamp was omitted",
    createdAt: 0,
  };

  const post = normalizeLinkedInPost(rawPost);
  const [workflowPost] = sanitizeProspectEvidencePostsForWorkflow(
    [rawPost],
    "linkedin"
  );

  assert.equal(post?.createdAt, expectedTimestamp);
  assert.ok(workflowPost);
  assert.equal(workflowPost?.createdAt, expectedTimestamp);
  assert.equal(
    getWorkflowEvidencePostCreatedAt(workflowPost),
    "2026-06-12T12:38:25.347Z"
  );
});

test("LinkedIn post references match numeric ids, URNs, and canonical URLs", () => {
  const post = {
    postID: "urn:li:activity:7483172695904333824",
    postURL:
      "https://www.linkedin.com/feed/update/urn:li:activity:7483172695904333824/",
  };

  assert.equal(matchesLinkedInPostReference(post, "7483172695904333824"), true);
  assert.equal(
    matchesLinkedInPostReference(
      { id: "7483172695904333824", platform: "linkedin" },
      "urn:li:activity:7483172695904333824"
    ),
    true
  );
  assert.equal(matchesLinkedInPostReference(post, "different-post"), false);
});

test("posted LinkedIn comment previews use the established comment contract", () => {
  const comment = buildLinkedInCommentPreview({
    id: "comment-1",
    postId: "post-1",
    text: "A posted comment",
    author: { name: "Viewer", isViewer: true },
  });

  assert.equal(comment.source, "preview");
  assert.equal(comment.text, "A posted comment");
  assert.equal(comment.canReact, false);
  assert.equal(comment.canReply, false);
});
