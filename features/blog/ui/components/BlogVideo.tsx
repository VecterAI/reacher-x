import VideoPlayer from "@/features/landing/ui/components/VideoPlayer";
import { getMediaAspectRatio } from "@/shared/lib/platforms/mediaPresentation";

export function BlogVideo({
  src,
  poster,
  title,
  caption,
  captions,
  width,
  height,
}: {
  src: string;
  poster: string;
  title: string;
  caption?: string;
  captions?: string;
  width: number;
  height: number;
}) {
  const ratio = getMediaAspectRatio({ width, height });
  return (
    <figure className="not-prose my-8">
      <div
        className="border-border mx-auto w-full overflow-hidden rounded-md border bg-black"
        style={{ aspectRatio: ratio }}
      >
        <VideoPlayer
          mp4Url={src}
          poster={poster}
          ariaLabel={title}
          preload="none"
        >
          {captions && (
            <track
              kind="captions"
              src={captions}
              srcLang="en"
              label="English"
              default
            />
          )}
        </VideoPlayer>
      </div>
      {caption && (
        <figcaption className="text-muted-foreground mt-3 text-center text-sm leading-5">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
