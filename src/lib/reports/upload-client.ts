"use client";

import { upload } from "@vercel/blob/client";
import { mimeOf } from "./files";

export interface UploadedFile {
  url: string;
  pathname: string;
}

/**
 * Uploads a report file straight from the browser: to Vercel Blob when it is configured,
 * otherwise to the local /api/upload/local route. Reports progress 0–100.
 */
export async function uploadReportFile(
  file: File,
  pathname: string,
  blobEnabled: boolean,
  onProgress: (pct: number) => void,
): Promise<UploadedFile> {
  if (blobEnabled) {
    const res = await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      contentType: mimeOf(file),
      onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
    });
    return { url: res.url, pathname: res.pathname };
  }
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", new File([file], file.name, { type: mimeOf(file) }));
    form.append("pathname", pathname);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/local");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json.error ?? `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
