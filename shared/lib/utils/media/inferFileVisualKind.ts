import { inferAttachmentMediaKind } from "./inferAttachmentMediaKind";

export type FileVisualKind =
  | "archive"
  | "audio"
  | "code"
  | "document"
  | "image"
  | "pdf"
  | "presentation"
  | "spreadsheet"
  | "video";

const ARCHIVE_EXTENSION_PATTERN = /\.(7z|bz2|gz|rar|tar|tgz|zip)(?:$|[?#])/;
const AUDIO_EXTENSION_PATTERN = /\.(aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/;
const CODE_EXTENSION_PATTERN =
  /\.(c|cpp|css|go|html?|java|jsx?|json|md|php|py|rb|rs|scss|sh|sql|tsx?|ya?ml)(?:$|[?#])/;
const PDF_EXTENSION_PATTERN = /\.pdf(?:$|[?#])/;
const PRESENTATION_EXTENSION_PATTERN =
  /\.(key|odp|pps|ppsx|ppt|pptx)(?:$|[?#])/;
const SPREADSHEET_EXTENSION_PATTERN =
  /\.(csv|numbers|ods|tsv|xls|xlsx)(?:$|[?#])/;
const CODE_MIME_TYPES = new Set([
  "application/javascript",
  "application/json",
  "application/typescript",
  "application/x-javascript",
  "text/css",
  "text/html",
  "text/javascript",
  "text/typescript",
]);

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function inferFileVisualKind(args: {
  fileName?: string | null;
  mimeType?: string | null;
  url?: string | null;
}): FileVisualKind {
  const mimeType = normalize(args.mimeType);
  const pathLikeValue = [args.fileName, args.url]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
  // Keep the filename and URL as independent extension candidates. Joining a
  // concrete filename to a generated blob URL makes the filename extension no
  // longer terminal (for example, `clip.mov blob:...`) and used to downgrade
  // decrypted XChat videos to generic files.
  const mediaKind =
    inferAttachmentMediaKind({ mimeType, url: args.fileName }) ??
    inferAttachmentMediaKind({ mimeType, url: args.url });

  if (mediaKind === "image" || mediaKind === "gif") {
    return "image";
  }
  if (mediaKind === "video") {
    return "video";
  }
  if (
    mimeType.startsWith("audio/") ||
    AUDIO_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "audio";
  }
  if (
    mimeType === "application/pdf" ||
    PDF_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "pdf";
  }
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv" ||
    SPREADSHEET_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "spreadsheet";
  }
  if (
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint") ||
    PRESENTATION_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "presentation";
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("archive") ||
    ARCHIVE_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "archive";
  }
  if (
    CODE_MIME_TYPES.has(mimeType) ||
    mimeType.endsWith("+json") ||
    CODE_EXTENSION_PATTERN.test(pathLikeValue)
  ) {
    return "code";
  }

  return "document";
}
