import "server-only";
import { del, put } from "@vercel/blob";
import { mkdir, readFile as fsRead, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

/**
 * File storage. Vercel Blob when BLOB_READ_WRITE_TOKEN is set; otherwise files are written to
 * .data/uploads and served by /api/files so the app works locally without a Blob store.
 */
export const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
export const LOCAL_PREFIX = "/api/files/";

export function safePathname(p: string): string {
  const clean = p
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== "." && s !== "..")
    .map((s) => s.replace(/[^\w.\-]+/g, "_"))
    .join("/");
  if (!clean) throw new Error("Invalid file path");
  return clean;
}

export async function putFile(pathname: string, body: Buffer, contentType: string): Promise<{ url: string; pathname: string }> {
  const clean = safePathname(pathname);
  if (env.hasBlob) {
    const res = await put(clean, body, { access: "public", contentType, addRandomSuffix: true });
    return { url: res.url, pathname: res.pathname };
  }
  const stamped = clean.replace(/(\.[\w]+)?$/, (ext) => `-${Date.now().toString(36)}${ext}`);
  const full = path.join(LOCAL_ROOT, stamped);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
  return { url: LOCAL_PREFIX + stamped, pathname: stamped };
}

export function localPathFor(url: string): string | null {
  if (!url.startsWith(LOCAL_PREFIX)) return null;
  const rel = safePathname(decodeURIComponent(url.slice(LOCAL_PREFIX.length)));
  const full = path.join(LOCAL_ROOT, rel);
  return full.startsWith(LOCAL_ROOT) ? full : null;
}

export async function readFile(url: string): Promise<Buffer> {
  const local = localPathFor(url);
  if (local) return fsRead(local);
  if (url.startsWith("/")) {
    // Seeded sample files live in /public.
    return fsRead(path.join(process.cwd(), "public", safePathname(url)));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download file (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

export async function deleteFile(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const local = localPathFor(url);
  if (local) {
    await rm(local, { force: true });
    return;
  }
  if (env.hasBlob && /^https:\/\/.+\.blob\.vercel-storage\.com\//.test(url)) {
    await del(url);
  }
}
