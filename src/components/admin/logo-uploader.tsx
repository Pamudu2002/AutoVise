"use client";

import { CircleAlert, Moon, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LogoBg } from "@/lib/logo-tile";

export const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX = 2 * 1024 * 1024;

export interface LogoState {
  file: File | null;
  url: string | null;
  removed: boolean;
}

function check(file: File): { title: string; body: string } | null {
  if (!LOGO_ACCEPT.split(",").includes(file.type)) return { title: "File type not supported", body: `“${file.name}” is not a PNG, SVG, JPG or WebP image.` };
  if (file.size > MAX) return { title: "File is too large", body: `“${file.name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB. Logos must be 2 MB or smaller.` };
  return null;
}

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** Drag-and-drop logo upload with a square-fit preview, tile background choice and an optional dark-theme logo. */
export function LogoUploader(props: {
  logo: LogoState;
  dark: LogoState;
  bg: LogoBg;
  onLogo: (s: LogoState) => void;
  onDark: (s: LogoState) => void;
  onBg: (bg: LogoBg) => void;
}) {
  const { logo, dark, bg } = props;
  const input = useRef<HTMLInputElement>(null);
  const darkInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<{ title: string; body: string } | null>(null);
  const logoUrl = useObjectUrl(logo.file) ?? (logo.removed ? null : logo.url);
  const darkUrl = useObjectUrl(dark.file) ?? (dark.removed ? null : dark.url);

  const take = (f: File | undefined, which: "logo" | "dark") => {
    if (!f) return;
    const e = check(f);
    if (e) return setError(e);
    setError(null);
    if (which === "logo") props.onLogo({ ...logo, file: f, removed: false });
    else props.onDark({ ...dark, file: f, removed: false });
  };

  const BG_OPTS: { v: LogoBg; label: string; swatch: string }[] = [
    { v: "light", label: "Light", swatch: "#FFFFFF" },
    { v: "dark", label: "Dark", swatch: "#0F172A" },
    { v: "transparent", label: "Transparent", swatch: "transparent" },
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-labelledby="logo-h">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 id="logo-h" style={{ fontSize: 15, fontWeight: 600 }}>
          Company logo
        </h3>
        <span className="hint">Shown on cards, the pitch header, tables and chat</span>
      </div>
      <input ref={input} type="file" accept={LOGO_ACCEPT} hidden onChange={(e) => take(e.target.files?.[0], "logo")} />
      <input ref={darkInput} type="file" accept={LOGO_ACCEPT} hidden onChange={(e) => take(e.target.files?.[0], "dark")} />

      {error && (
        <div role="alert" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", borderRadius: 10, background: "var(--neg-soft)", border: "1px solid color-mix(in srgb, var(--neg) 35%, transparent)" }}>
          <CircleAlert size={18} style={{ color: "var(--neg)", flex: "none", marginTop: 1 }} aria-hidden />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{error.title}</span>
            <span style={{ fontSize: 13, lineHeight: 1.5 }}>{error.body}</span>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}>
            Choose another file
          </button>
        </div>
      )}

      {!logoUrl ? (
        <div
          className={`drop${over ? " over" : ""}`}
          style={{ padding: "28px 20px" }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            take(e.dataTransfer.files?.[0], "logo");
          }}
        >
          <span style={{ width: 44, height: 44, borderRadius: 12, background: "var(--card)", border: "1px solid var(--border)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--primary-text)" }}>
            <Upload size={20} aria-hidden />
          </span>
          <span style={{ fontWeight: 500 }}>
            Drop logo here or{" "}
            <button type="button" className="link-btn" onClick={() => input.current?.click()}>
              browse
            </button>
          </span>
          <span className="hint">PNG, SVG, JPG, WebP — max 2 MB. Transparent SVG or PNG works best.</span>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="checker" style={{ position: "relative", width: 168, height: 168, borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }} role="img" aria-label="Square fit preview of the logo">
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview of an unsaved file */}
                <img src={logoUrl} alt="" style={{ position: "absolute", inset: 20, width: 128, height: 128, objectFit: "contain" }} />
                <span aria-hidden="true" style={{ position: "absolute", inset: 20, border: "1px dashed #6B7280", borderRadius: 6 }} />
              </div>
              <span className="hint" style={{ width: 168 }}>
                Dashed line: the 12% safe area every tile keeps clear.
              </span>
            </div>
            <div style={{ flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="num" style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {logo.file?.name ?? "Current logo"}
                </span>
                <span className="hint">{logo.file ? `${(logo.file.size / 1024).toFixed(0)} KB · rasters are trimmed and saved as 512 × 512 WebP` : "Saved"}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => input.current?.click()}>
                  <Upload size={14} aria-hidden />
                  Replace
                </button>
                <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--neg)" }} onClick={() => props.onLogo({ file: null, url: logo.url, removed: true })}>
                  <Trash2 size={14} aria-hidden />
                  Remove
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <span className="label" id="bg-l">
              Tile background
            </span>
            <div className="seg" role="group" aria-labelledby="bg-l" style={{ alignSelf: "flex-start" }}>
              {BG_OPTS.map((o) => (
                <button key={o.v} type="button" className={`seg-btn${bg === o.v ? " on" : ""}`} aria-pressed={bg === o.v} onClick={() => props.onBg(o.v)} style={{ padding: "0 12px" }}>
                  <span aria-hidden className={o.v === "transparent" ? "checker" : undefined} style={{ width: 12, height: 12, borderRadius: 3, border: "1px solid var(--border-strong)", background: o.v === "transparent" ? undefined : o.swatch }} />
                  {o.label}
                </button>
              ))}
            </div>
            <span className="hint">
              {bg === "transparent" ? "The logo sits on the card colour. In dark theme it uses the dark logo, or a light tile if there isn't one." : bg === "light" ? "Always on a white tile — best for dark or colourful logos." : "Always on a dark navy tile — best for white logos."}
            </span>
          </div>

          <div className="field">
            <span className="label">
              Dark theme logo <span style={{ fontWeight: 400, color: "var(--muted)" }}>(optional)</span>
            </span>
            {darkUrl ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                <span className="logo" style={{ width: 40, height: 40, borderRadius: 10, padding: 6, background: "#121A2D", borderColor: "#232C46" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={darkUrl} alt="" />
                </span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span className="num" style={{ fontSize: 13, fontWeight: 500 }}>
                    {dark.file?.name ?? "Current dark logo"}
                  </span>
                  <span className="hint">Used on transparent tiles in dark theme</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => props.onDark({ file: null, url: dark.url, removed: true })}>
                  Remove
                </button>
              </div>
            ) : (
              <div className="drop" style={{ padding: "14px 16px", flexDirection: "row", justifyContent: "flex-start", textAlign: "left", gap: 12 }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), take(e.dataTransfer.files?.[0], "dark"))}>
                <Moon size={18} style={{ color: "var(--muted)" }} aria-hidden />
                <span style={{ fontSize: 13, flex: 1 }}>
                  Drop a light-on-dark version, or{" "}
                  <button type="button" className="link-btn" onClick={() => darkInput.current?.click()}>
                    browse
                  </button>
                  . Without one, dark theme puts this logo on a light tile.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function useLogoPreviewUrl(s: LogoState) {
  const obj = useObjectUrl(s.file);
  return obj ?? (s.removed ? null : s.url);
}
