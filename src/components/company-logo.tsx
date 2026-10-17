"use client";

import Image from "next/image";
import { useCallback, useState, type CSSProperties } from "react";
import {
  brandColorOf,
  initialsOf,
  logoVariants,
  tilePadding,
  tileRadius,
  type LogoSource,
  type TileVariant,
} from "@/lib/logo-tile";

interface Props extends LogoSource {
  size: 32 | 36 | 40 | 48 | 64 | 96;
  /** Decorative logos (next to a visible name) use an empty alt. */
  decorative?: boolean;
  /** The 96px company-header tile shrinks to 64px on phones. */
  hero?: boolean;
  className?: string;
}

/**
 * Company logo tile. Same visual size for every logo whatever its shape; monogram on the brand
 * colour when there is no logo or it fails to load; skeleton while the image loads.
 */
export function CompanyLogo({ size, decorative, hero, className, ...c }: Props) {
  const [failed, setFailed] = useState(false);
  const variants = failed ? null : logoVariants(c);
  const radius = tileRadius(size);
  const box: CSSProperties = { width: size, height: size, borderRadius: radius };
  const cls = ["logo", hero ? "logo-hero" : "", className ?? ""].join(" ").trim();

  if (!variants) {
    return (
      <span
        className={`${cls} logo-mono`}
        style={{ ...box, fontSize: Math.round(size * 0.36), ["--brand" as string]: brandColorOf(c) }}
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : `${c.name} logo`}
        aria-hidden={decorative ? true : undefined}
      >
        {initialsOf(c.name)}
      </span>
    );
  }

  const alt = decorative ? "" : `${c.name} logo`;
  const same = variants.light.src === variants.dark.src && variants.light.fill === variants.dark.fill;
  if (same) return <Tile v={variants.light} box={box} pad={tilePadding(size, c.logoShape)} alt={alt} cls={cls} onFail={() => setFailed(true)} />;
  return (
    <>
      <Tile v={variants.light} box={box} pad={tilePadding(size, c.logoShape)} alt={alt} cls={`${cls} theme-light-only`} onFail={() => setFailed(true)} />
      <Tile v={variants.dark} box={box} pad={tilePadding(size, c.logoShape)} alt={alt} cls={`${cls} theme-dark-only`} onFail={() => setFailed(true)} />
    </>
  );
}

function Tile({ v, box, pad, alt, cls, onFail }: { v: TileVariant; box: CSSProperties; pad: number; alt: string; cls: string; onFail: () => void }) {
  const dim = Number(box.width) * 2;
  const [loaded, setLoaded] = useState(false);
  // An image can finish loading before hydration; check `complete` so the skeleton never sticks.
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      if (img.naturalWidth > 0) setLoaded(true);
      else onFail();
    }
  }, [onFail]);
  return (
    <span className={cls} style={{ ...box, padding: pad, background: v.fill, borderColor: v.border, position: "relative" }}>
      {!loaded && <span className="sk" aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: 0 }} />}
      <Image
        ref={ref}
        src={v.src}
        alt={alt}
        width={dim}
        height={dim}
        sizes={`${dim / 2}px`}
        unoptimized={/\.svg(\?|$)/i.test(v.src) || /^(blob:|data:|\/api\/files\/)/.test(v.src)}
        onLoad={() => setLoaded(true)}
        onError={onFail}
      />
    </span>
  );
}
