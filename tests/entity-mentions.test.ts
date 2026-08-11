import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMentionEntityReferenceLine,
  normalizeMentionEntitySearchResult,
  type MentionEntitySearchResult,
} from "../shared/lib/mentions/mentionEntities";
import {
  buildAgentMentionReplacementText,
  filterSelectedMentionEntitiesByInput,
} from "../features/agent/lib/entityMentions";
import {
  buildComposerMentionInsertionText,
  buildInitialMediaUploadFromMentionEntity,
} from "../features/composer/lib/entityMentions";

test("agent mention helpers keep visible inline text and drop partial false positives", () => {
  const personEntity: MentionEntitySearchResult = {
    id: "prospect:john",
    entityId: "john",
    kind: "prospect",
    label: "John Doe",
    mentionText: "John Doe",
    secondaryLabel: "@john",
    avatarUrl: null,
    verified: false,
    handle: "john",
  };
  const planEntity: MentionEntitySearchResult = {
    id: "plan:jane",
    entityId: "jane-plan",
    kind: "plan",
    label: "Plan for Jane Doe",
    mentionText: "Plan for Jane Doe",
    secondaryLabel: "approved plan",
    avatarUrl: null,
    verified: false,
    planId: "jane-plan",
  };

  assert.equal(
    buildAgentMentionReplacementText(planEntity),
    "@Plan for Jane Doe "
  );

  assert.deepEqual(
    filterSelectedMentionEntitiesByInput({
      input: "Review this with @John Doe and @Plan for Jane Doe tomorrow.",
      entities: [personEntity, planEntity],
    }).map((entity) => entity.id),
    [personEntity.id, planEntity.id]
  );

  assert.deepEqual(
    filterSelectedMentionEntitiesByInput({
      input: "Review this with @Johnny tomorrow.",
      entities: [personEntity],
    }),
    []
  );
});

test("composer mention helpers use scoped handles, post URLs, and attachment uploads", () => {
  const personEntity: MentionEntitySearchResult = {
    id: "prospect:john",
    entityId: "john",
    kind: "prospect",
    label: "John Doe",
    mentionText: "John Doe",
    secondaryLabel: "@john",
    avatarUrl: null,
    verified: false,
    handle: "john",
  };
  const postEntity: MentionEntitySearchResult = {
    id: "post:x:123",
    entityId: "123",
    kind: "post",
    label: "Need migration researchers",
    mentionText: "Post: Need migration researchers",
    secondaryLabel: "X post",
    avatarUrl: null,
    verified: false,
    postId: "123",
    postPlatform: "twitter",
    postUrl: "https://x.com/john/status/123",
  };
  const attachmentEntity: MentionEntitySearchResult = {
    id: "attachment:file-1",
    entityId: "file-1",
    kind: "attachment",
    label: "candidates-use-case.jpg",
    mentionText: "Attachment: candidates-use-case.jpg",
    secondaryLabel: "Workspace attachment",
    avatarUrl: null,
    verified: false,
    attachmentUrl: "https://cdn.example.com/candidates-use-case.jpg",
    attachmentMimeType: "image/jpeg",
    attachmentMediaKind: "image",
    attachmentSize: 2048,
  };

  assert.equal(
    buildComposerMentionInsertionText({
      entity: personEntity,
      config: { personTextMode: "handle" },
    }),
    "@john "
  );
  assert.equal(
    buildComposerMentionInsertionText({
      entity: postEntity,
    }),
    "https://x.com/john/status/123 "
  );
  assert.equal(
    buildComposerMentionInsertionText({
      entity: attachmentEntity,
    }),
    null
  );
  assert.deepEqual(buildInitialMediaUploadFromMentionEntity(attachmentEntity), {
    id: "mention-attachment:file-1",
    url: "https://cdn.example.com/candidates-use-case.jpg",
    serverUrl: "https://cdn.example.com/candidates-use-case.jpg",
    uploadId: "file-1",
    type: "image",
    mediaKind: "image",
    fileName: "candidates-use-case.jpg",
    mimeType: "image/jpeg",
    size: 2048,
    description: undefined,
  });
});

test("attachment mention normalization preserves disabled PDF metadata", () => {
  const attachment = normalizeMentionEntitySearchResult({
    id: "attachment:file-2",
    entityId: "file-2",
    kind: "attachment",
    label: "results.pdf",
    mentionText: "Attachment: results.pdf",
    secondaryLabel: "Workspace attachment",
    avatarUrl: null,
    verified: false,
    attachmentUrl: "https://cdn.example.com/results.pdf",
    attachmentMimeType: "application/pdf",
    attachmentMediaKind: "file",
    attachmentSize: 4096,
    attachmentDisabled: true,
    attachmentDisabledReason: "results.pdf cannot be attached to X/Twitter.",
  });

  assert.ok(attachment);
  assert.equal(attachment.attachmentMediaKind, "file");
  assert.equal(attachment.attachmentSize, 4096);
  assert.equal(attachment.attachmentDisabled, true);
  assert.equal(
    attachment.attachmentDisabledReason,
    "results.pdf cannot be attached to X/Twitter."
  );
  assert.deepEqual(buildInitialMediaUploadFromMentionEntity(attachment), {
    id: "mention-attachment:file-2",
    url: "https://cdn.example.com/results.pdf",
    serverUrl: "https://cdn.example.com/results.pdf",
    uploadId: "file-2",
    type: "file",
    mediaKind: "file",
    fileName: "results.pdf",
    mimeType: "application/pdf",
    size: 4096,
    description: undefined,
  });
});

test("reply and comment mention builders preserve visible text and insert URLs in composer", () => {
  const twitterReplyEntity: MentionEntitySearchResult = {
    id: "post:twitter-reply:456",
    entityId: "456",
    kind: "post",
    label: "Appreciate this thread",
    mentionText: "Reply: Appreciate this thread",
    secondaryLabel: "X reply • @john",
    avatarUrl: null,
    verified: false,
    postId: "456",
    postPlatform: "twitter",
    postUrl: "https://x.com/john/status/456",
  };
  const linkedInCommentEntity: MentionEntitySearchResult = {
    id: "post:linkedin-comment:activity:123:urn:li:comment:(activity:123,456)",
    entityId: "urn:li:comment:(activity:123,456)",
    kind: "post",
    label: "Great breakdown on outbound sequencing.",
    mentionText: "Comment: Great breakdown on outbound sequencing.",
    secondaryLabel: "LinkedIn comment • Jane Founder",
    avatarUrl: null,
    verified: false,
    postId: "urn:li:comment:(activity:123,456)",
    postPlatform: "linkedin",
    postUrl:
      "https://www.linkedin.com/feed/update/urn:li:activity:123?commentUrn=urn:li:comment:(activity:123,456)",
  };

  assert.equal(
    buildAgentMentionReplacementText(twitterReplyEntity),
    "@Reply: Appreciate this thread "
  );
  assert.equal(
    buildComposerMentionInsertionText({
      entity: twitterReplyEntity,
    }),
    "https://x.com/john/status/456 "
  );
  assert.equal(
    buildComposerMentionInsertionText({
      entity: linkedInCommentEntity,
    }),
    "https://www.linkedin.com/feed/update/urn:li:activity:123?commentUrn=urn:li:comment:(activity:123,456) "
  );
});

test("post mention normalization backfills exact hidden references for sparse entities", () => {
  const sparseTwitterReply = normalizeMentionEntitySearchResult({
    id: "post:twitter-reply:456",
    entityId: "456",
    kind: "post",
    label: "Appreciate this thread",
    mentionText: "Reply: Appreciate this thread",
    secondaryLabel: "X reply • @john",
    avatarUrl: null,
    verified: false,
  });
  const sparseLinkedInComment = normalizeMentionEntitySearchResult({
    id: "post:linkedin-comment:activity:123:456",
    entityId: "urn:li:comment:(activity:123,456)",
    kind: "post",
    label: "Great breakdown on outbound sequencing.",
    mentionText: "Comment: Great breakdown on outbound sequencing.",
    secondaryLabel: "LinkedIn comment • Jane Founder",
    avatarUrl: null,
    verified: false,
    postPlatform: "linkedin",
  });

  assert.equal(sparseTwitterReply?.postUrl, "https://x.com/i/status/456");
  assert.equal(
    sparseTwitterReply?.referenceText,
    "Reply: Appreciate this thread (platform: twitter; postId: 456; url: https://x.com/i/status/456)"
  );
  assert.equal(
    sparseLinkedInComment?.postUrl,
    "https://www.linkedin.com/feed/update/urn:li:activity:123?commentUrn=urn:li:comment:(activity:123,456)"
  );
  assert.equal(
    sparseLinkedInComment?.referenceText,
    "Comment: Great breakdown on outbound sequencing. (platform: linkedin; postId: urn:li:comment:(activity:123,456); url: https://www.linkedin.com/feed/update/urn:li:activity:123?commentUrn=urn:li:comment:(activity:123,456))"
  );
  assert.equal(
    buildMentionEntityReferenceLine(sparseLinkedInComment!),
    sparseLinkedInComment?.referenceText
  );
});
