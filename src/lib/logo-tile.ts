/**
 * Logo tile rules from design/autovise-design (Logos.dc.html): fixed square tile, 1px border,
 * object-contain, radius min(14, size × 0.25), padding by logo shape, tile fill light/dark/transparent,
 * dark-theme logo when one exists, and a light tile for transparent logos in dark mode without one.
 */

export type LogoBg = "light" | "dark" | "transparent";
export type LogoShape = "square" | "round" | "tall" | "wide";

export const LOGO_PAD: Record<LogoShape, number> = { square: 0.16, round: 0.14, tall: 0.1, wide: 0.07 };
export const DARK_TILE_FILL = "#0F172A";
export const DARK_TILE_BORDER = "#1E293B";

export interface LogoSource {
  name: string;
  ticker: string;
  logoUrl: string | null;
  logoDarkUrl?: string | null;
  logoBg?: LogoBg | null;
  logoShape?: LogoShape | null;
  brandColor?: string | null;
}

export interface TileVariant {
  src: string;
  fill: string;
  border?: string;
}

export function tileRadius(size: number) {
  return Math.min(14, Math.round(size * 0.25));
}

export function tilePadding(size: number, shape: LogoShape | null | undefined) {
  return Math.max(2, Math.round(size * (LOGO_PAD[shape ?? "square"] ?? 0.12)));
}

const fillFor = (bg: LogoBg) => (bg === "light" ? "#FFFFFF" : bg === "dark" ? DARK_TILE_FILL : "transparent");

/** The light-theme and dark-theme renderings of an image logo. */
export function logoVariants(c: LogoSource): { light: TileVariant; dark: TileVariant } | null {
  if (!c.logoUrl) return null;
  const bg = c.logoBg ?? "transparent";
  const light: TileVariant = { src: c.logoUrl, fill: fillFor(bg), border: bg === "dark" ? DARK_TILE_BORDER : undefined };
  let dark: TileVariant;
  if (c.logoDarkUrl) dark = { src: c.logoDarkUrl, fill: fillFor(bg), border: bg === "dark" ? DARK_TILE_BORDER : undefined };
  else if (bg === "transparent") dark = { src: c.logoUrl, fill: "#FFFFFF" };
  else dark = light;
  return { light, dark };
}

export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^[A-Z0-9]/.test(w));
  return (words.slice(0, 2).map((w) => w[0]).join("") || name.slice(0, 2)).toUpperCase();
}

const FALLBACK_COLORS = ["#1F4E8C", "#0E9384", "#3F7D3A", "#8B1E3F", "#9A6A2F", "#C2410C", "#6D28D9", "#0284C7"];

/** brand_color, or a stable colour derived from the ticker. */
export function brandColorOf(c: Pick<LogoSource, "brandColor" | "ticker">): string {
  if (c.brandColor && /^#[0-9a-fA-F]{6}$/.test(c.brandColor)) return c.brandColor;
  let h = 0;
  for (const ch of c.ticker) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLORS[h % FALLBACK_COLORS.length];
}

/** Card accent colour: the brand colour, lightened in dark mode via CSS color-mix. */
export function accentFor(color: string) {
  return { light: color, dark: `color-mix(in srgb, ${color} 65%, #FFFFFF)` };
}
