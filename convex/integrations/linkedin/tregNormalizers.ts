import { getLinkedInActivityTimestamp } from "../../../shared/lib/linkedin/post";
import { extractLinkedInUsername } from "../../../shared/lib/utils/url/socialProfiles";
import { getCurrentUTCTimestamp } from "../../../shared/lib/utils/time/timeUtils";
import type {
  LinkedInCompany,
  LinkedInFundingData,
  LinkedInHeadquarter,
} from "./getCompany";
import type {
  LinkedInContactInfo,
  LinkedInPosition,
  LinkedInProfile,
} from "./getProfile";
import type { LinkedInProfilePost } from "./getProfilePosts";
import type { LinkedInPerson } from "./searchPeople";
import type { LinkedInPost } from "./searchPosts";

type LooseRecord = Record<string, unknown>;

const MONTH_INDEX_BY_ABBR: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function asRecord(value: unknown): LooseRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as LooseRecord)
    : null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asRecordArray(value: unknown): LooseRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is LooseRecord => asRecord(item) !== null);
}

function unwrapOutput(raw: unknown): LooseRecord {
  const root = asRecord(raw);
  if (!root) return {};
  const output = asRecord(root.output);
  if (output) return output;
  const data = asRecord(root.data);
  if (data) return data;
  return root;
}

const MAX_JS_DATE_MS = 8_640_000_000_000_000;

function toValidDateTimestampMs(ms: number): number | undefined {
  if (!Number.isFinite(ms) || ms <= 0 || Math.abs(ms) > MAX_JS_DATE_MS) {
    return undefined;
  }
  return Number.isFinite(new Date(ms).getTime()) ? ms : undefined;
}

function parseTimestampMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value < 1_000_000_000_000 ? Math.trunc(value * 1000) : value;
    return toValidDateTimestampMs(ms);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric) && numeric > 0) {
      const ms =
        numeric < 1_000_000_000_000 ? Math.trunc(numeric * 1000) : numeric;
      return toValidDateTimestampMs(ms);
    }
    const parsed = Date.parse(value.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return toValidDateTimestampMs(parsed);
    }
  }
  const record = asRecord(value);
  if (record) {
    return (
      parseTimestampMs(record.timestamp) ??
      parseTimestampMs(record.date) ??
      parseTimestampMs(record.datePublished) ??
      parseTimestampMs(record.createdAt)
    );
  }
  return undefined;
}

function parseDatePart(input: unknown): {
  year: number;
  month: number;
  day: number;
} {
  const rec = asRecord(input);
  if (rec) {
    return {
      year: asNumber(rec.year) ?? 0,
      month: asNumber(rec.month) ?? 0,
      day: asNumber(rec.day) ?? 0,
    };
  }
  const str = asString(input);
  if (!str || /present/i.test(str)) {
    return { year: 0, month: 0, day: 0 };
  }
  const monthYear = /^([a-z]{3})[a-z]*\s+(\d{4})$/i.exec(str);
  if (monthYear) {
    return {
      year: Number(monthYear[2]),
      month: MONTH_INDEX_BY_ABBR[monthYear[1].toLowerCase()] ?? 0,
      day: 0,
    };
  }
  const yearOnly = /(\d{4})/.exec(str);
  return {
    year: yearOnly ? Number(yearOnly[1]) : 0,
    month: 0,
    day: 0,
  };
}

function parseDateRange(
  dateRange: string | undefined,
  startInput: unknown,
  endInput: unknown
) {
  if (startInput || endInput) {
    return {
      start: parseDatePart(startInput),
      end: parseDatePart(endInput),
    };
  }
  if (!dateRange) {
    return {
      start: { year: 0, month: 0, day: 0 },
      end: { year: 0, month: 0, day: 0 },
    };
  }
  const [rawStart, rawEnd] = dateRange.split(/\s*[-–]\s*/);
  return {
    start: parseDatePart(rawStart),
    end: parseDatePart(rawEnd),
  };
}

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function extractActivityNumericId(urnOrId: string): string {
  const match = /(\d{10,})/.exec(urnOrId);
  return match?.[1] ?? urnOrId;
}

function normalizePostUrn(rawId: string): string {
  if (rawId.startsWith("urn:li:")) return rawId;
  if (/^\d+$/.test(rawId)) return `urn:li:activity:${rawId}`;
  return rawId;
}

function buildPostUrlFromUrn(urn: string, fallbackUrl?: string): string {
  if (fallbackUrl) return fallbackUrl;
  return `https://www.linkedin.com/feed/update/${normalizePostUrn(urn)}/`;
}

function formatLocationText(value: unknown): string {
  const direct = asString(value);
  if (direct) return direct;
  const rec = asRecord(value);
  if (!rec) return "";
  return (
    asString(rec.linkedinText) ??
    asString(rec.full) ??
    asString(rec.fullLocation) ??
    [asString(rec.city), asString(rec.country)].filter(Boolean).join(", ")
  );
}

/** Map LinkdAPI datePosted filters to HarvestAPI postedLimit values. */
export function mapDatePostedToHarvestLimit(
  datePosted?: string
): "24h" | "week" | "month" | "year" | undefined {
  switch (datePosted) {
    case "past-24h":
      return "24h";
    case "past-week":
      return "week";
    case "past-month":
      return "month";
    case "past-year":
      return "year";
    default:
      return undefined;
  }
}

/** Map LinkdAPI datePosted filters to AnyAPI datePosted values. */
export function mapDatePostedToAnyApi(datePosted?: string): string | undefined {
  switch (datePosted) {
    case "past-24h":
      return "past-24h";
    case "past-week":
      return "last-week";
    case "past-month":
      return "last-month";
    default:
      return undefined;
  }
}

/** Map LinkdAPI datePosted filters to ScrapeCreators date_posted values. */
export function mapDatePostedToScrapeCreators(
  datePosted?: string
): "last-day" | "last-week" | "last-month" | "last-year" | undefined {
  switch (datePosted) {
    case "past-24h":
      return "last-day";
    case "past-week":
      return "last-week";
    case "past-month":
      return "last-month";
    case "past-year":
      return "last-year";
    default:
      return undefined;
  }
}

/** Map LinkdAPI sortBy values to HarvestAPI sortBy values. */
export function mapSortByToHarvest(
  sortBy?: "relevance" | "date_posted"
): "relevance" | "date" {
  return sortBy === "date_posted" ? "date" : "relevance";
}

/** Extract LinkedIn numeric geoId from harvestapi.linkedin.geo.search output. */
export function normalizeTregGeoLookup(raw: unknown): string | undefined {
  const root = unwrapOutput(raw);
  const candidates = asRecordArray(
    root.elements ?? root.results ?? (Array.isArray(raw) ? raw : [])
  );
  for (const item of candidates) {
    const geoId = asString(item.geoId) ?? asString(item.id);
    if (geoId) return geoId;
    const numericId = asNumber(item.geoId) ?? asNumber(item.id);
    if (numericId !== undefined) return String(numericId);
  }
  return undefined;
}

/** Normalize people search pages from treg.people.search or harvestapi.linkedin.profile.search. */
export function normalizeTregPeopleSearchPage(
  raw: unknown,
  opts: { start: number; count: number }
): {
  people: LinkedInPerson[];
  total: number;
  start: number;
  hasMore: boolean;
  nextCursor: string | null;
} {
  const root = unwrapOutput(raw);
  const rows = asRecordArray(
    root.people ?? root.elements ?? root.results ?? root.items
  );

  const people: LinkedInPerson[] = [];
  for (const row of rows) {
    const rawUrl =
      asString(row.linkedinUrl) ??
      asString(row.profile_url) ??
      asString(row.profileUrl) ??
      asString(row.url) ??
      "";
    const publicIdentifier =
      asString(row.publicIdentifier) ??
      asString(row.username) ??
      (rawUrl ? extractLinkedInUsername(rawUrl) : undefined) ??
      "";
    const profileID =
      asString(row.profileID) ??
      asString(row.profileId) ??
      asString(row.id) ??
      publicIdentifier;
    const urn =
      asString(row.urn) ?? (profileID ? `urn:li:fsd_profile:${profileID}` : "");
    const url =
      rawUrl ||
      (publicIdentifier
        ? `https://www.linkedin.com/in/${publicIdentifier}`
        : "");

    if (!urn && !profileID && !url) continue;

    const fullName =
      asString(row.fullName) ??
      asString(row.name) ??
      [asString(row.firstName), asString(row.lastName)]
        .filter(Boolean)
        .join(" ");
    const split = splitFullName(fullName);
    const firstName = asString(row.firstName) ?? split.firstName;
    const lastName = asString(row.lastName) ?? split.lastName;
    const title = asString(row.title) ?? asString(row.position);
    const company = asString(row.company) ?? asString(row.companyName);
    const headline =
      asString(row.headline) ??
      (title && company ? `${title} at ${company}` : (title ?? ""));

    const photoRecord = asRecord(row.photo);
    const profilePictureURL =
      asString(row.profilePictureURL) ??
      asString(row.profilePictureUrl) ??
      asString(row.photo) ??
      asString(photoRecord?.url) ??
      "";

    people.push({
      urn: urn || profileID || url,
      profileID: profileID || publicIdentifier || url,
      url,
      firstName,
      lastName,
      fullName: fullName || `${firstName} ${lastName}`.trim(),
      headline,
      location: formatLocationText(row.location),
      profilePictureURL,
      premium: asBoolean(row.premium) ?? false,
    });
  }

  const pagination = asRecord(root.pagination);
  const nextCursor =
    asString(root.next_cursor) ??
    asString(root.paginationToken) ??
    asString(pagination?.paginationToken) ??
    null;
  const total =
    asNumber(pagination?.totalResultCount) ??
    asNumber(pagination?.totalElements) ??
    asNumber(root.total) ??
    asNumber(root.count) ??
    people.length;
  const pageNumber = asNumber(pagination?.pageNumber);
  const totalPages = asNumber(pagination?.totalPages);
  const hasMore =
    Boolean(nextCursor) ||
    asBoolean(root.hasMore) === true ||
    (pageNumber !== undefined &&
      totalPages !== undefined &&
      pageNumber < totalPages);

  return {
    people,
    total,
    start: opts.start,
    hasMore,
    nextCursor,
  };
}

function extractActivityIdFromPostUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const activityMatch = /activity(?::|-)(\d{10,})/i.exec(url);
  if (activityMatch?.[1]) return activityMatch[1];
  const ugcMatch = /ugcPost:(\d{10,})/i.exec(url);
  if (ugcMatch?.[1]) return `urn:li:ugcPost:${ugcMatch[1]}`;
  const shareMatch = /share:(\d{10,})/i.exec(url);
  if (shareMatch?.[1]) return `urn:li:share:${shareMatch[1]}`;
  return undefined;
}

function normalizeHarvestOrGenericPost(
  record: LooseRecord
): LinkedInPost | null {
  const candidateUrl =
    asString(record.postURL) ??
    asString(record.linkedinUrl) ??
    asString(record.shareLinkedinUrl) ??
    asString(record.url);
  const rawId =
    asString(record.urn) ??
    asString(record.entityId) ??
    asString(record.id) ??
    asString(record.postID) ??
    asString(record.shareUrn) ??
    extractActivityIdFromPostUrl(candidateUrl);
  if (!rawId) return null;

  const urn = normalizePostUrn(rawId);
  const postID = extractActivityNumericId(rawId);
  const postURL = buildPostUrlFromUrn(urn, candidateUrl);
  const text =
    asString(record.text) ??
    asString(record.content) ??
    asString(record.description) ??
    asString(record.commentary) ??
    "";

  const authorRec = asRecord(record.author) ?? asRecord(record.profile) ?? {};
  const avatarRec = asRecord(authorRec.avatar);
  const authorUrl =
    asString(authorRec.url) ?? asString(authorRec.linkedinUrl) ?? "";
  const authorHandle =
    asString(authorRec.publicIdentifier) ??
    asString(authorRec.universalName) ??
    (authorUrl ? extractLinkedInUsername(authorUrl) : undefined);
  const authorId =
    asString(authorRec.id) ??
    asString(authorRec.profileId) ??
    asString(authorRec.companyId) ??
    authorHandle ??
    "";
  const authorUrn =
    asString(authorRec.urn) ??
    (authorId ? `urn:li:fsd_profile:${authorId}` : "");

  const timestamp =
    parseTimestampMs(record.postedAt) ??
    parseTimestampMs(record.datePublished) ??
    parseTimestampMs(record.date) ??
    parseTimestampMs(record.createdAt) ??
    getLinkedInActivityTimestamp(urn) ??
    getCurrentUTCTimestamp();
  const postedAtRec = asRecord(record.postedAt);
  const fullDate =
    asString(postedAtRec?.fullDate) ??
    asString(postedAtRec?.date) ??
    asString(record.datePublished) ??
    asString(record.date) ??
    new Date(timestamp).toISOString();

  const engagementRec =
    asRecord(record.engagement) ?? asRecord(record.engagements) ?? {};
  const reactions = asRecordArray(engagementRec.reactions).map((item) => ({
    reactionType: asString(item.reactionType) ?? asString(item.type) ?? "LIKE",
    reactionCount: asNumber(item.reactionCount) ?? asNumber(item.count) ?? 0,
  }));

  const mediaContent: LinkedInPost["mediaContent"] = [];
  for (const item of asRecordArray(record.mediaContent)) {
    const url = asString(item.url);
    if (url) {
      mediaContent.push({
        type: asString(item.type) ?? "image",
        url,
      });
    }
  }
  for (const item of asRecordArray(record.postImages)) {
    const url = asString(item.url);
    if (url) {
      mediaContent.push({ type: "image", url });
    }
  }
  const postVideo = asRecord(record.postVideo);
  const videoUrl = asString(postVideo?.videoUrl) ?? asString(record.videoUrl);
  if (videoUrl) {
    mediaContent.push({ type: "video", url: videoUrl });
  }

  return {
    urn,
    postID,
    postURL,
    text,
    author: {
      name: asString(authorRec.name) ?? "",
      headline: asString(authorRec.headline) ?? asString(authorRec.info) ?? "",
      urn: authorUrn,
      id: authorId,
      url: authorUrl,
      profilePictureURL:
        asString(authorRec.profilePictureURL) ??
        asString(authorRec.profilePictureUrl) ??
        asString(avatarRec?.url) ??
        "",
    },
    postedAt: {
      timestamp,
      fullDate,
      relativeDay: asString(postedAtRec?.relativeDay) ?? "",
    },
    engagements: {
      totalReactions:
        asNumber(engagementRec.totalReactions) ??
        asNumber(engagementRec.likes) ??
        asNumber(record.reactionCount) ??
        0,
      commentsCount:
        asNumber(engagementRec.commentsCount) ??
        asNumber(engagementRec.comments) ??
        asNumber(record.commentCount) ??
        0,
      repostsCount:
        asNumber(engagementRec.repostsCount) ??
        asNumber(engagementRec.shares) ??
        asNumber(record.sharesCount) ??
        0,
      reactions: reactions.length > 0 ? reactions : null,
    },
    mediaContent,
  };
}

/** Normalize LinkedIn post search pages from harvestapi, anyapi, or scrapecreators. */
export function normalizeTregSearchPostsPage(
  raw: unknown,
  opts: { start: number }
): {
  posts: LinkedInPost[];
  total: number;
  start: number;
  count: number;
  hasMore: boolean;
  nextPaginationToken: string | null;
} {
  const root = unwrapOutput(raw);
  const rows = asRecordArray(
    root.elements ??
      root.posts ??
      root.results ??
      root.items ??
      (Array.isArray(raw) ? raw : [])
  );
  const posts = rows
    .map(normalizeHarvestOrGenericPost)
    .filter((post): post is LinkedInPost => post !== null);

  const pagination = asRecord(root.pagination);
  const nextPaginationToken =
    asString(pagination?.paginationToken) ??
    asString(root.paginationToken) ??
    asString(root.next_cursor) ??
    null;
  const pageNumber = asNumber(pagination?.pageNumber);
  const totalPages = asNumber(pagination?.totalPages);
  const total =
    asNumber(pagination?.totalResultCount) ??
    asNumber(pagination?.totalElements) ??
    asNumber(root.total) ??
    posts.length;
  const hasMore =
    Boolean(nextPaginationToken) ||
    asBoolean(root.hasMore) === true ||
    (pageNumber !== undefined &&
      totalPages !== undefined &&
      pageNumber < totalPages);

  return {
    posts,
    total,
    start: opts.start,
    count: posts.length,
    hasMore,
    nextPaginationToken,
  };
}

export interface TregProfileSupplemental {
  followerCount?: number;
  connectionsCount?: number;
  backgroundImageUrl?: string;
  contactInfo?: LinkedInContactInfo;
}

function normalizePositionEntry(entry: LooseRecord): LinkedInPosition {
  const { start, end } = parseDateRange(
    asString(entry.dateRange),
    entry.start ?? entry.startDate,
    entry.end ?? entry.endDate
  );
  const companyRec = asRecord(entry.company);
  return {
    companyId: asNumber(entry.companyId) ?? asNumber(companyRec?.id) ?? 0,
    companyName:
      asString(entry.companyName) ??
      asString(entry.name) ??
      asString(companyRec?.name) ??
      "",
    companyUsername:
      asString(entry.companyUsername) ??
      asString(entry.companyPublicId) ??
      asString(companyRec?.universalName) ??
      "",
    companyURL:
      asString(entry.companyURL) ??
      asString(entry.companyLinkedinUrl) ??
      asString(companyRec?.linkedinUrl) ??
      "",
    companyLogo:
      asString(entry.companyLogo) ?? asString(companyRec?.logoUrl) ?? "",
    companyIndustry:
      asString(entry.companyIndustry) ?? asString(companyRec?.industry) ?? "",
    companyStaffCountRange: asString(entry.companyStaffCountRange) ?? "",
    title:
      asString(entry.title) ??
      asString(entry.jobTitle) ??
      asString(entry.position) ??
      "",
    location:
      asString(entry.location) ??
      asString(entry.locationName) ??
      asString(entry.geoLocationName) ??
      "",
    description: asString(entry.description) ?? "",
    employmentType: asString(entry.employmentType) ?? "",
    start,
    end,
  };
}

/** Normalize full LinkedIn profile from fetchinio, treg routed, or harvestapi. */
export function normalizeTregUserProfile(raw: unknown): {
  profile: LinkedInProfile;
  supplemental: TregProfileSupplemental;
} {
  const root = unwrapOutput(raw);
  const profileUrl = asString(root.url) ?? asString(root.linkedinUrl) ?? "";
  const username =
    asString(root.publicIdentifier) ??
    asString(root.username) ??
    (profileUrl ? extractLinkedInUsername(profileUrl) : undefined) ??
    "";
  const profileId =
    asString(root.profileId) ??
    asString(root.id)?.replace(/^urn:li:fsd_profile:/i, "") ??
    username;
  const urn =
    asString(root.urn) ??
    (asString(root.id)?.startsWith("urn:li:")
      ? asString(root.id)!
      : profileId
        ? `urn:li:fsd_profile:${profileId}`
        : "");

  const fullName = asString(root.fullName) ?? asString(root.name) ?? "";
  const split = splitFullName(fullName);
  const firstName = asString(root.firstName) ?? split.firstName;
  const lastName = asString(root.lastName) ?? split.lastName;

  const locationRec = asRecord(root.location);
  const geoFull =
    asString(root.geoLocationName) ??
    asString(locationRec?.linkedinText) ??
    asString(locationRec?.full) ??
    asString(root.location) ??
    "";
  const geoCountry =
    asString(root.geoCountryName) ?? asString(locationRec?.country) ?? "";
  const geoCity =
    asString(locationRec?.city) ??
    (geoFull.includes(",") ? (geoFull.split(",")[0]?.trim() ?? "") : geoFull);
  const countryCode =
    asString(root.countryCode) ?? asString(locationRec?.countryCode) ?? "";

  const rawPositions = asRecordArray(
    root.experiences ?? root.experience ?? root.fullPositions ?? root.position
  );
  const positions = rawPositions.map(normalizePositionEntry);

  const rawSkills = Array.isArray(root.skills) ? root.skills : [];
  const skills = rawSkills
    .map((item) => {
      if (typeof item === "string") {
        return { name: item.trim(), passedSkillAssessment: false };
      }
      const rec = asRecord(item);
      const name = asString(rec?.name);
      if (!name) return null;
      return {
        name,
        passedSkillAssessment: asBoolean(rec?.passedSkillAssessment) ?? false,
      };
    })
    .filter(
      (item): item is { name: string; passedSkillAssessment: boolean } =>
        item !== null && item.name.length > 0
    );

  const rawLanguages = Array.isArray(root.languages) ? root.languages : [];
  const languages = rawLanguages
    .map((item) => {
      if (typeof item === "string") {
        return { name: item.trim(), proficiency: "" };
      }
      const rec = asRecord(item);
      const name = asString(rec?.name);
      if (!name) return null;
      return {
        name,
        proficiency: asString(rec?.proficiency) ?? "",
      };
    })
    .filter(
      (item): item is { name: string; proficiency: string } =>
        item !== null && item.name.length > 0
    );

  const websites = asRecordArray(root.websites)
    .map((item) => ({
      url: asString(item.url) ?? "",
      category: asString(item.category) ?? "OTHER",
    }))
    .filter((item) => item.url.length > 0);

  const emailAddress =
    asString(root.email) ?? asString(root.emailAddress) ?? null;
  const phoneNumber =
    asString(root.phone) ?? asString(root.phoneNumber) ?? null;

  const profile: LinkedInProfile = {
    id: asNumber(root.memberId) ?? asNumber(root.id) ?? 0,
    urn,
    username,
    firstName,
    lastName,
    isCreator: asBoolean(root.creator) ?? asBoolean(root.isCreator) ?? false,
    isPremium: asBoolean(root.premium) ?? asBoolean(root.isPremium) ?? false,
    profilePicture:
      asString(root.profilePictureUrl) ??
      asString(root.profilePicture) ??
      asString(root.photo) ??
      "",
    summary:
      asString(root.description) ??
      asString(root.about) ??
      asString(root.summary) ??
      "",
    headline: asString(root.title) ?? asString(root.headline) ?? "",
    geo: {
      country: geoCountry,
      city: geoCity,
      full: geoFull,
      countryCode,
    },
    position: positions,
    fullPositions: positions,
    skills,
    languages,
    educations: Array.isArray(root.educations)
      ? root.educations
      : Array.isArray(root.education)
        ? root.education
        : [],
    certifications: Array.isArray(root.certifications)
      ? root.certifications
      : [],
  };

  const supplemental: TregProfileSupplemental = {
    followerCount:
      asNumber(root.followerCount) ?? asNumber(root.followersCount),
    connectionsCount:
      asNumber(root.connectionsCount) ?? asNumber(root.connectionCount),
    backgroundImageUrl:
      asString(root.coverImageUrl) ?? asString(root.backgroundImageUrl),
    contactInfo:
      emailAddress || phoneNumber || websites.length > 0
        ? { emailAddress, phoneNumber, websites }
        : undefined,
  };

  return { profile, supplemental };
}

function normalizeProfilePostRecord(
  record: LooseRecord
): LinkedInProfilePost | null {
  const rawUrn =
    asString(record.urn) ??
    asString(record.id) ??
    asString(record.entityId) ??
    asString(record.shareUrn);
  if (!rawUrn) return null;

  const urn = normalizePostUrn(rawUrn);
  const text =
    asString(record.text) ??
    asString(record.content) ??
    asString(record.commentary) ??
    "";
  const postedAt =
    parseTimestampMs(record.postedAt) ??
    parseTimestampMs(record.date) ??
    parseTimestampMs(record.createdAt) ??
    getLinkedInActivityTimestamp(urn) ??
    getCurrentUTCTimestamp();

  const authorRec = asRecord(record.author) ?? asRecord(record.profile);
  const avatarRec = asRecord(authorRec?.avatar);
  const headerRec = asRecord(record.header);
  const engagementRec =
    asRecord(record.engagements) ?? asRecord(record.engagement);

  const mediaContent: Array<{ type?: string; url?: string }> = [];
  for (const item of asRecordArray(record.mediaContent)) {
    const url = asString(item.url);
    if (url) mediaContent.push({ type: asString(item.type), url });
  }
  for (const item of asRecordArray(record.postImages)) {
    const url = asString(item.url);
    if (url) mediaContent.push({ type: "image", url });
  }
  if (Array.isArray(record.images)) {
    for (const item of record.images) {
      const url =
        typeof item === "string"
          ? asString(item)
          : asString(asRecord(item)?.url);
      if (url) mediaContent.push({ type: "image", url });
    }
  }
  const singleImage = asString(record.imageUrl);
  if (singleImage && !mediaContent.some((m) => m.url === singleImage)) {
    mediaContent.push({ type: "image", url: singleImage });
  }
  const singleVideo =
    asString(record.videoUrl) ?? asString(asRecord(record.postVideo)?.videoUrl);
  if (singleVideo) {
    mediaContent.push({ type: "video", url: singleVideo });
  }

  const resharedRec =
    asRecord(record.resharedPostContent) ?? asRecord(record.resharedPost);
  const resharedPostContent = resharedRec
    ? (normalizeProfilePostRecord(resharedRec) ?? undefined)
    : undefined;

  return {
    urn,
    url: buildPostUrlFromUrn(
      urn,
      asString(record.url) ??
        asString(record.shareUrl) ??
        asString(record.linkedinUrl) ??
        asString(record.shareLinkedinUrl)
    ),
    header: asString(record.header) ?? asString(headerRec?.text),
    text,
    postedAt,
    author: authorRec
      ? {
          name:
            asString(authorRec.name) ??
            [asString(authorRec.firstName), asString(authorRec.lastName)]
              .filter(Boolean)
              .join(" "),
          headline:
            asString(authorRec.headline) ??
            asString(authorRec.title) ??
            asString(authorRec.info),
          urn: asString(authorRec.urn) ?? asString(authorRec.id),
          url: asString(authorRec.url) ?? asString(authorRec.linkedinUrl),
          profilePictureURL:
            asString(authorRec.profilePictureURL) ??
            asString(authorRec.profilePictureUrl) ??
            asString(avatarRec?.url),
          type: asString(authorRec.type) ?? asString(record.authorType),
        }
      : undefined,
    engagements: {
      totalReactions:
        asNumber(engagementRec?.totalReactions) ??
        asNumber(engagementRec?.likes) ??
        asNumber(record.reactionCount),
      commentsCount:
        asNumber(engagementRec?.commentsCount) ??
        asNumber(engagementRec?.comments) ??
        asNumber(record.commentCount),
      repostsCount:
        asNumber(engagementRec?.repostsCount) ??
        asNumber(engagementRec?.shares) ??
        asNumber(record.sharesCount),
    },
    mediaContent: mediaContent.length > 0 ? mediaContent : undefined,
    resharedPostContent,
  };
}

/** Normalize profile or company posts from fetchinio, treg routed, harvestapi, or tikhub. */
export function normalizeTregProfilePostsPage(
  raw: unknown,
  opts: { maxPosts?: number } = {}
): {
  posts: LinkedInProfilePost[];
  nextCursor: string | null;
} {
  const root = unwrapOutput(raw);
  const rows = asRecordArray(
    root.posts ??
      root.elements ??
      root.items ??
      root.results ??
      (Array.isArray(raw) ? raw : [])
  );
  const normalized = rows
    .map(normalizeProfilePostRecord)
    .filter((post): post is LinkedInProfilePost => post !== null);

  const pagination = asRecord(root.pagination);
  const nextCursor =
    asString(root.paginationToken) ??
    asString(root.next_cursor) ??
    asString(pagination?.paginationToken) ??
    asString(root.cursor) ??
    null;

  const posts =
    opts.maxPosts !== undefined
      ? normalized.slice(0, Math.max(0, Math.floor(opts.maxPosts)))
      : normalized;

  return {
    posts,
    nextCursor,
  };
}

/**
 * Normalize post comments from fetchinio, treg routed, or harvestapi into the
 * exact LinkdAPI-compatible comment object expected by `normalizeLinkdApiComment`.
 */
export function normalizeTregPostCommentsPage(raw: unknown): {
  comments: Array<Record<string, unknown>>;
  cursor: string | null;
} {
  const root = unwrapOutput(raw);
  const rows = asRecordArray(
    root.comments ??
      root.elements ??
      root.items ??
      root.results ??
      (Array.isArray(raw) ? raw : [])
  );

  const comments: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const id =
      asString(row.id) ??
      asString(row.urn) ??
      asString(row.commentUrn) ??
      asString(row.permalink) ??
      asString(row.linkedinUrl);
    if (!id) continue;

    const authorRec =
      asRecord(row.author) ??
      asRecord(row.actor) ??
      asRecord(row.profile) ??
      {};
    const avatarRec = asRecord(authorRec.avatar);
    const engagementRec = asRecord(row.engagements) ?? asRecord(row.engagement);
    const createdAt =
      parseTimestampMs(row.createdAt) ??
      parseTimestampMs(row.date) ??
      parseTimestampMs(row.createdAtTimestamp);

    comments.push({
      id,
      comment:
        asString(row.comment) ??
        asString(row.text) ??
        asString(row.commentary) ??
        "",
      text:
        asString(row.text) ??
        asString(row.comment) ??
        asString(row.commentary) ??
        "",
      ...(createdAt !== undefined ? { createdAt } : {}),
      ...(asBoolean(row.edited) !== undefined
        ? { edited: asBoolean(row.edited) }
        : {}),
      permalink:
        asString(row.permalink) ??
        asString(row.linkedinUrl) ??
        asString(row.url),
      engagements: {
        totalReactions:
          asNumber(engagementRec?.totalReactions) ??
          asNumber(engagementRec?.likes) ??
          asNumber(row.reactionCount) ??
          asNumber(row.likesCount) ??
          0,
        commentsCount:
          asNumber(engagementRec?.commentsCount) ??
          asNumber(engagementRec?.replies) ??
          asNumber(row.replyCount) ??
          asNumber(row.commentsCount) ??
          0,
      },
      author: {
        id:
          asString(authorRec.id) ??
          asString(authorRec.profileId) ??
          asString(authorRec.publicIdentifier),
        urn: asString(authorRec.urn) ?? asString(authorRec.id),
        name:
          asString(authorRec.name) ??
          ([asString(authorRec.firstName), asString(authorRec.lastName)]
            .filter(Boolean)
            .join(" ") ||
            "LinkedIn user"),
        headline:
          asString(authorRec.headline) ??
          asString(authorRec.title) ??
          asString(authorRec.info),
        url: asString(authorRec.url) ?? asString(authorRec.linkedinUrl),
        profilePictureURL:
          asString(authorRec.profilePictureURL) ??
          asString(authorRec.profilePictureUrl) ??
          asString(avatarRec?.url),
      },
    });
  }

  const pagination = asRecord(root.pagination);
  const cursor =
    asString(root.paginationToken) ??
    asString(root.next_cursor) ??
    asString(pagination?.paginationToken) ??
    asString(root.cursor) ??
    null;

  return { comments, cursor };
}

function normalizeHeadquarter(record: LooseRecord | null): LinkedInHeadquarter {
  if (!record) {
    return {
      countryCode: "",
      geographicArea: "",
      country: "",
      city: "",
      headquarter: false,
    };
  }
  const country = asString(record.country) ?? "";
  return {
    countryCode:
      asString(record.countryCode) ?? (country.length === 2 ? country : ""),
    geographicArea:
      asString(record.geographicArea) ?? asString(record.state) ?? "",
    country,
    city: asString(record.city) ?? "",
    postalCode: asString(record.postalCode),
    headquarter: asBoolean(record.headquarter) ?? false,
    line1: asString(record.line1),
  };
}

function formatStaffCountRange(value: unknown): string {
  const direct = asString(value);
  if (direct) return direct;
  const rec = asRecord(value);
  if (!rec) return "";
  const start = asNumber(rec.start);
  const end = asNumber(rec.end);
  if (start !== undefined && end !== undefined) return `${start}-${end}`;
  if (start !== undefined) return `${start}+`;
  return "";
}

/** Normalize company profile from fetchinio, treg routed, or harvestapi. */
export function normalizeTregCompany(raw: unknown): LinkedInCompany {
  const root = unwrapOutput(raw);
  const hq = normalizeHeadquarter(asRecord(root.headquarter));
  const locations = asRecordArray(root.locations).map(normalizeHeadquarter);
  const industries = Array.isArray(root.industriesV2)
    ? root.industriesV2.filter(
        (item): item is string => typeof item === "string"
      )
    : Array.isArray(root.industries)
      ? root.industries.filter(
          (item): item is string => typeof item === "string"
        )
      : asString(root.industry)
        ? [asString(root.industry)!]
        : [];
  const specialities = Array.isArray(root.specialities)
    ? root.specialities.filter(
        (item): item is string => typeof item === "string"
      )
    : Array.isArray(root.specialties)
      ? root.specialties.filter(
          (item): item is string => typeof item === "string"
        )
      : [];

  const fundingData = asRecord(root.fundingData) as LinkedInFundingData | null;

  return {
    id:
      asString(root.companyId) ??
      asString(root.id)?.replace(/^urn:li:fsd_company:/i, "") ??
      "",
    name: asString(root.name) ?? "",
    universalName:
      asString(root.publicIdentifier) ?? asString(root.universalName) ?? "",
    linkedinUrl: asString(root.url) ?? asString(root.linkedinUrl) ?? "",
    description: asString(root.description) ?? "",
    type: asString(root.companyType) ?? asString(root.type) ?? "",
    images: {
      logo:
        asString(root.logoUrl) ?? asString(asRecord(root.images)?.logo) ?? "",
      cover:
        asString(root.coverImageUrl) ??
        asString(asRecord(root.images)?.cover) ??
        "",
    },
    staffCount: asNumber(root.employeeCount) ?? asNumber(root.staffCount) ?? 0,
    headquarter: hq,
    locations,
    industriesV2: industries,
    specialities,
    website: asString(root.websiteUrl) ?? asString(root.website) ?? "",
    founded: parseDatePart(root.foundedOn ?? root.founded),
    followerCount: asNumber(root.followerCount) ?? 0,
    staffCountRange: formatStaffCountRange(
      root.employeeCountRange ?? root.staffCountRange
    ),
    crunchbaseUrl: asString(root.crunchbaseUrl),
    fundingData: fundingData ?? undefined,
  };
}

/** Normalize optional contact enrichment returned by treg.people.enrich. */
export function normalizeTregContactEnrichment(
  raw: unknown
): LinkedInContactInfo {
  const root = unwrapOutput(raw);
  const emails = Array.isArray(root.emails) ? root.emails : [];
  const firstEmail =
    asString(root.email) ??
    asString(root.work_email) ??
    asString(root.emailAddress) ??
    (typeof emails[0] === "string"
      ? asString(emails[0])
      : asString(asRecord(emails[0])?.address)) ??
    null;

  const phones = Array.isArray(root.phones) ? root.phones : [];
  const firstPhone =
    asString(root.phone) ??
    asString(root.phoneNumber) ??
    (typeof phones[0] === "string"
      ? asString(phones[0])
      : asString(asRecord(phones[0])?.number)) ??
    null;

  const websites = asRecordArray(root.websites)
    .map((item) => ({
      url: asString(item.url) ?? "",
      category: asString(item.category) ?? "OTHER",
    }))
    .filter((item) => item.url.length > 0);

  return {
    emailAddress: firstEmail,
    phoneNumber: firstPhone,
    websites,
  };
}

/** Filter normalized posts by LinkdAPI-style datePosted window when provided. */
export function filterLinkedInPostsByDatePosted(
  posts: LinkedInPost[],
  datePosted?: string,
  nowMs: number = getCurrentUTCTimestamp()
): LinkedInPost[] {
  const windowMsByFilter: Record<string, number> = {
    "past-24h": 24 * 60 * 60 * 1000,
    "past-week": 7 * 24 * 60 * 60 * 1000,
    "past-month": 30 * 24 * 60 * 60 * 1000,
    "past-year": 365 * 24 * 60 * 60 * 1000,
  };
  const windowMs = datePosted ? windowMsByFilter[datePosted] : undefined;
  if (!windowMs) return posts;

  const cutoff = nowMs - windowMs;
  return posts.filter((post) => post.postedAt.timestamp >= cutoff);
}

/** Local case-insensitive keyword filter for user posts fallback when only a URN is known. */
export function filterLinkedInPostsByKeyword(
  posts: LinkedInPost[],
  keyword?: string
): LinkedInPost[] {
  const normalized = keyword?.trim().toLowerCase();
  if (!normalized) return posts;

  const terms = normalized
    .replaceAll('"', " ")
    .split(/\s+/)
    .filter((term) => term.length > 1 && term !== "and" && term !== "or");
  if (terms.length === 0) return posts;

  return posts.filter((post) => {
    const haystack = `${post.text} ${post.author.headline}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

/** Convert a normalized LinkedInProfilePost into a LinkedInPost (used for user-post fallback). */
export function toLinkedInSearchPostFromProfilePost(
  post: LinkedInProfilePost,
  fallbackProfileUrn: string
): LinkedInPost {
  const postID = extractActivityNumericId(post.urn);
  const postURL = buildPostUrlFromUrn(post.urn, post.url);
  return {
    urn: post.urn,
    postID,
    postURL,
    text: post.text,
    author: {
      name: post.author?.name ?? "",
      headline: post.author?.headline ?? "",
      urn: post.author?.urn ?? `urn:li:fsd_profile:${fallbackProfileUrn}`,
      id:
        post.author?.urn?.replace(/^urn:li:fsd_profile:/i, "") ??
        fallbackProfileUrn,
      url: post.author?.url ?? "",
      profilePictureURL: post.author?.profilePictureURL ?? "",
    },
    postedAt: {
      timestamp: post.postedAt,
      fullDate: new Date(post.postedAt).toISOString(),
      relativeDay: "",
    },
    engagements: {
      totalReactions: post.engagements?.totalReactions ?? 0,
      commentsCount: post.engagements?.commentsCount ?? 0,
      repostsCount: post.engagements?.repostsCount ?? 0,
      reactions: null,
    },
    mediaContent: (post.mediaContent ?? [])
      .filter((item): item is { type?: string; url: string } =>
        Boolean(item.url)
      )
      .map((item) => ({
        type: item.type ?? "image",
        url: item.url,
      })),
  };
}
