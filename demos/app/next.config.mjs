import { fileURLToPath } from "node:url";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants.js";

export default function config(phase) {
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    !process.env.NEXT_PUBLIC_DEMO_PARENT_ORIGIN
  )
    throw new Error(
      "Set NEXT_PUBLIC_DEMO_PARENT_ORIGIN to the embedding site's exact origin before building demos/app."
    );
  const parent = process.env.NEXT_PUBLIC_DEMO_PARENT_ORIGIN;
  if (parent && new URL(parent).origin !== parent)
    throw new Error(
      "Use the exact parent origin, without a path or trailing slash."
    );
  return {
    // Temporary uploads must use their no-store response, without optimizer caching.
    images: { unoptimized: true },
    async headers() {
      return [
        {
          source: "/media/portraits/:path*",
          has: [{ type: "query", key: "v", value: "[a-f0-9]{12}" }],
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
        ...(parent
          ? [
              {
                source: "/:path*",
                headers: [
                  {
                    key: "Content-Security-Policy",
                    value: `frame-ancestors 'self' ${parent}`,
                  },
                ],
              },
            ]
          : []),
      ];
    },
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    turbopack: {
      root: fileURLToPath(new URL("../../", import.meta.url)),
      // Substitute browser services only in this isolated app. The production
      // components and their default implementations remain shared and intact.
      resolveAlias: {
        "@/features/agent/lib/xChatBrowserSession":
          "./runtime/demoXChatBrowserSession.ts",
        "@/features/composer/hooks/useVoiceNoteRecorder":
          "./runtime/useSampleVoiceNoteRecorder.ts",
        "@/shared/lib/linkedin/media": "./runtime/demoMediaHelpers.ts",
      },
    },
  };
}
