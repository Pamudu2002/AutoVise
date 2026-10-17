import "server-only";
import sharp from "sharp";
import type { LogoShape } from "@/lib/logo-tile";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;

export class LogoError extends Error {
  constructor(
    public title: string,
    message: string,
  ) {
    super(message);
  }
}

function sniff(buf: Buffer): (typeof LOGO_TYPES)[number] | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  const head = buf.subarray(0, 1024).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "image/svg+xml";
  return null;
}

/**
 * Removes anything executable or external from an SVG: scripts, foreignObject, event handlers,
 * javascript: URLs, external hrefs and @import/url() references. DOCTYPE/ENTITY declarations
 * are rejected outright.
 */
export function sanitizeSvg(svg: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(svg)) throw new LogoError("SVG not accepted", "This SVG declares a DOCTYPE or entities. Export it again without them.");
  let s = svg.replace(/<\?xml[^>]*\?>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script\s*>/gi, "").replace(/<script[^>]*\/>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, "");
  s = s.replace(/<(iframe|embed|object|audio|video|animate|set|handler|listener)\b[\s\S]*?(<\/\1\s*>|\/>)/gi, "");
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Only internal (#id) and inline raster data references may stay.
  s = s.replace(/\s+(xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, (m, _x, v: string) => {
    const val = v.slice(1, -1).trim();
    return val.startsWith("#") || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(val) ? m : "";
  });
  s = s.replace(/javascript:/gi, "").replace(/@import[^;]*;?/gi, "");
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none");
  if (!/<svg[\s>]/i.test(s)) throw new LogoError("SVG not accepted", "The file does not contain an <svg> element.");
  return s.trim();
}

function shapeFromRatio(r: number): LogoShape {
  if (r >= 1.6) return "wide";
  if (r <= 0.7) return "tall";
  return "square";
}

function svgRatio(svg: string): number {
  const vb = svg.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (vb) return Number(vb[1]) / Number(vb[2]) || 1;
  const w = svg.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i);
  const h = svg.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
  return w && h ? Number(w[1]) / Number(h[1]) || 1 : 1;
}

export interface ProcessedLogo {
  body: Buffer;
  contentType: "image/webp" | "image/svg+xml";
  ext: "webp" | "svg";
  shape: LogoShape;
  width: number;
  height: number;
}

/**
 * Raster logos are trimmed, padded to a transparent square and resized to 512×512 WebP.
 * SVGs are sanitised and kept as vectors.
 */
export async function processLogo(buf: Buffer, declaredType: string): Promise<ProcessedLogo> {
  if (buf.length > LOGO_MAX_BYTES) {
    throw new LogoError("File is too large", `This file is ${(buf.length / 1024 / 1024).toFixed(1)} MB. Logos must be 2 MB or smaller.`);
  }
  const type = sniff(buf);
  if (!type || !(LOGO_TYPES as readonly string[]).includes(declaredType)) {
    throw new LogoError("File type not supported", "Upload a PNG, SVG, JPG or WebP image.");
  }

  if (type === "image/svg+xml") {
    const clean = sanitizeSvg(buf.toString("utf8"));
    const ratio = svgRatio(clean);
    return { body: Buffer.from(clean, "utf8"), contentType: "image/svg+xml", ext: "svg", shape: shapeFromRatio(ratio), width: 0, height: 0 };
  }

  const meta = await sharp(buf).metadata();
  if (!meta.width || !meta.height) throw new LogoError("Image could not be read", "The file looks damaged. Export it again and retry.");
  if (Math.max(meta.width, meta.height) < 64) {
    throw new LogoError("Image is too small", `This image is ${meta.width} × ${meta.height}. Use at least 64 px on the longest side, ideally 512 px.`);
  }

  let trimmed: Buffer;
  try {
    trimmed = await sharp(buf).trim({ threshold: 12 }).toBuffer();
  } catch {
    trimmed = buf; // uniform images cannot be trimmed; keep as is
  }
  const tMeta = await sharp(trimmed).metadata();
  const shape = shapeFromRatio((tMeta.width ?? 1) / (tMeta.height ?? 1));
  const body = await sharp(trimmed)
    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toBuffer();
  return { body, contentType: "image/webp", ext: "webp", shape, width: 512, height: 512 };
}
