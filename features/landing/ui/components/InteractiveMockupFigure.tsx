"use client";

import Image from "next/image";
import * as React from "react";
import {
  LANDING_MOCKUP_ASSETS,
  type LandingMockupAssetKey,
} from "@/features/landing/lib/mockupAssets";
import { cn } from "@/shared/lib/utils";

type ActiveLayer = "front" | "back";

interface InteractiveMockupFigureProps {
  mockupAssetKey: LandingMockupAssetKey;
  ariaLabel?: string;
  className?: string;
  figureClassName?: string;
}

const VIEWBOX_WIDTH = 1512;
const VIEWBOX_HEIGHT = 1134;

const BACK_FRAME = {
  left: 100,
  top: 155,
  width: 1688,
  height: 979.08,
};

const FRONT_FRAME = {
  left: 720,
  top: 100.25,
  width: 741.91,
  height: 1206.51,
};

const toPercent = (value: number, total: number) => `${(value / total) * 100}%`;
const BACK_IMAGE_SCALE = BACK_FRAME.width / VIEWBOX_WIDTH;
const FRONT_IMAGE_SCALE =
  (FRONT_FRAME.width / VIEWBOX_WIDTH) * (3024 * 0.000978474);
const BACK_IMAGE_SIZES = `(min-width: 1288px) ${Math.round(
  752 * BACK_IMAGE_SCALE
)}px, (min-width: 768px) 65vw, 112vw`;
const FRONT_IMAGE_SIZES = `(min-width: 1288px) ${Math.round(
  752 * FRONT_IMAGE_SCALE
)}px, (min-width: 768px) 76vw, 145vw`;

export function InteractiveMockupFigure({
  mockupAssetKey,
  ariaLabel,
  className,
  figureClassName,
}: InteractiveMockupFigureProps) {
  const [activeLayer, setActiveLayer] = React.useState<ActiveLayer>("front");
  const asset = LANDING_MOCKUP_ASSETS[mockupAssetKey];
  const frontPatternWidth = asset.front.width * asset.frontPattern.scaleX;
  const frontPatternHeight = asset.front.height * asset.frontPattern.scaleY;

  const toggleLayer = React.useCallback(() => {
    setActiveLayer((current) => (current === "front" ? "back" : "front"));
  }, []);

  return (
    <figure
      aria-label={ariaLabel}
      className={cn(
        "group relative aspect-square overflow-hidden outline-none",
        figureClassName
      )}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleLayer();
        }
      }}
      onMouseLeave={() => setActiveLayer("front")}
      onClick={toggleLayer}
      role="button"
      tabIndex={0}
    >
      <div
        className="absolute inset-x-0 top-0 -bottom-px overflow-hidden"
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const overFront =
            x >= rect.width * (FRONT_FRAME.left / VIEWBOX_WIDTH) &&
            y >= rect.height * (FRONT_FRAME.top / VIEWBOX_HEIGHT);
          const nextLayer = overFront ? "front" : "back";
          setActiveLayer((current) =>
            current === nextLayer ? current : nextLayer
          );
        }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 100%)",
          }}
        >
          <Image
            src="/landing/mockups/background-texture.webp"
            alt=""
            fill
            aria-hidden="true"
            className="object-cover opacity-80"
            sizes="(min-width: 1288px) 752px, (min-width: 768px) 58vw, 100vw"
          />
        </div>

        <div
          className={cn(
            "absolute overflow-hidden rounded-t-[0.8%] shadow-[0_5px_123px_rgba(0,0,0,0.12)]",
            activeLayer === "back" ? "z-30" : "z-10",
            className
          )}
          style={{
            left: toPercent(BACK_FRAME.left, VIEWBOX_WIDTH),
            top: toPercent(BACK_FRAME.top, VIEWBOX_HEIGHT),
            width: toPercent(BACK_FRAME.width, VIEWBOX_WIDTH),
            height: `calc(${toPercent(BACK_FRAME.height, VIEWBOX_HEIGHT)} + 1px)`,
            transform:
              activeLayer === "back"
                ? "translate3d(1.5%, 0, 0) scale(1.025)"
                : "translate3d(-1.25%, 1.75%, 0) scale(0.975)",
            transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
            transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          <Image
            src={asset.back.src}
            alt=""
            fill
            aria-hidden="true"
            className="object-fill"
            sizes={BACK_IMAGE_SIZES}
          />
        </div>

        <div
          className={cn(
            "absolute overflow-hidden rounded-[1.32%] border border-[#e5e5e5] shadow-[0_5px_123px_rgba(0,0,0,0.12)]",
            activeLayer === "front" ? "z-30" : "z-10",
            className
          )}
          style={{
            left: toPercent(FRONT_FRAME.left, VIEWBOX_WIDTH),
            top: toPercent(FRONT_FRAME.top, VIEWBOX_HEIGHT),
            width: toPercent(FRONT_FRAME.width, VIEWBOX_WIDTH),
            height: `calc(${toPercent(FRONT_FRAME.height, VIEWBOX_HEIGHT)} + 1px)`,
            transform:
              activeLayer === "front"
                ? "translate3d(0, 0, 0) scale(1)"
                : "translate3d(-7%, 9%, 0) scale(0.9)",
            transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)",
            transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            willChange: "transform",
          }}
        >
          <div
            className="absolute"
            style={{
              left: `${asset.frontPattern.translateX * 100}%`,
              top: `${asset.frontPattern.translateY * 100}%`,
              width: `${frontPatternWidth * 100}%`,
              height: `${frontPatternHeight * 100}%`,
            }}
          >
            <Image
              src={asset.front.src}
              alt=""
              fill
              aria-hidden="true"
              className="object-fill"
              sizes={FRONT_IMAGE_SIZES}
            />
          </div>
        </div>
      </div>
    </figure>
  );
}
