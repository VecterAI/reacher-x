import {
  normalizeLinkedInMediaType as normalizeProviderMediaType,
  isRenderableLinkedInImageUrl as isProviderImageUrl,
} from "../../../shared/lib/linkedin/media";
export { isLinkedInCdnImageUrl } from "../../../shared/lib/linkedin/media";
import { isDemoUploadedImageUrl } from "./uploadHelpers";

/** Demo-only allowlist; never relax the production provider policy. */
export function isRenderableLinkedInImageUrl(url: string): boolean {
  return (
    url === "/media/client-feedback.png" ||
    isDemoUploadedImageUrl(url) ||
    isProviderImageUrl(url)
  );
}

export function normalizeLinkedInMediaType(
  rawType: string | undefined,
  url: string | undefined
) {
  if (
    (url === "/media/client-feedback.png" ||
      (url !== undefined && isDemoUploadedImageUrl(url))) &&
    !["video", "link", "article", "document", "documents", "carousel"].includes(
      rawType?.trim().toLowerCase() ?? ""
    )
  )
    return "image";
  return normalizeProviderMediaType(rawType, url);
}
