import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocPage } from "@/components/doc-page";
import { pct } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Methodology", description: "How AutoVise builds a three-year share price prediction from a company's own reports." };

const TOC: [string, string][] = [
  ["#m-what", "What we predict"],
  ["#m-data", "Where the numbers come from"],
  ["#m-model", "The valuation model"],
  ["#m-qual", "Qualitative factors"],
  ["#m-conf", "Confidence and Score"],
  ["#m-update", "When predictions change"],
  ["#m-ai", "How AI is used"],
  ["#m-limits", "What the model cannot see"],
];

export default async function MethodologyPage() {
  const s = await getSettings();
  const v = s.valuation;
  const w = v.growthWeights;
  return (
    <DocPage active="methodology" toc={TOC}>
      <DocHeader
        eyebrow="Methodology"
        title="How AutoVise builds a prediction"
        lead="Every target on AutoVise can be traced back to a page in a company's own reports. This page explains each step, the limits of the model, and how you should — and should not — use what it produces."
      />

      <section id="m-what">
        <h2>1. What we predict</h2>
        <p>
          For each listed company we publish a share-price range three years ahead: a bear case, a base case and a bull case. The base case is our central estimate; the bear and bull cases show
          what happens if growth or valuation turn out materially worse or better. Each prediction also has a checkpoint every 12 months so it can be scored as it goes — see the{" "}
          <Link href="/track-record">Track Record</Link>.
        </p>
      </section>

      <section id="m-data">
        <h2>2. Where the numbers come from</h2>
        <p>
          Our analysts upload each company&apos;s annual and interim reports. The system extracts the financial statements and the management commentary, and every extracted figure carries a page
          reference. An analyst reviews and approves the extraction before it can affect a prediction. If a report is replaced — for example a restated annual report — the old version is kept,
          marked as superseded, and the prediction is recalculated from the new file.
        </p>
        <p>
          Share prices are entered by our analysts from exchange closing prices. If a company&apos;s newest approved report is more than 12 months old, its card is marked <strong>Outdated data</strong> and
          its confidence falls.
        </p>
      </section>

      <section id="m-model">
        <h2>3. The valuation model</h2>
        <p>The numbers come from deterministic code, never from an AI model. The base-case target is built in four steps:</p>
        <div className="card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10, boxShadow: "none" }}>
          <code className="num" style={{ fontSize: 15, lineHeight: 1.6, color: "var(--text)" }}>
            Target = EPS<sub>year 3</sub> × Exit P/E, adjusted for qualitative factors
          </code>
          <span style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
            EPS<sub>year n</sub> = EPS<sub>year n−1</sub> × (1 + g<sub>n</sub>), where g<sub>n</sub> starts at the blended growth rate and eases toward the sector rate each year
          </span>
        </div>
        <ul>
          <li>
            <strong>Earnings growth.</strong> A blend of the company&apos;s own EPS record ({pct(w.historical, 0)}), sustainable growth — return on equity × the share of profit retained ({pct(w.sustainable, 0)}) — and
            the sector benchmark ({pct(w.sector, 0)}). Each year {pct(v.meanReversion, 0)} of the gap to the sector rate closes. Growth is kept between {pct(v.minGrowth, 0)} and {pct(v.maxGrowth, 0)} a year.
          </li>
          <li>
            <strong>Exit multiple.</strong> The P/E we expect investors to pay in year three. It starts from today&apos;s multiple and moves {pct(v.peConvergence, 0)} of the way toward the sector
            benchmark, within {v.minExitPe}× to {v.maxExitPe}×.
          </li>
          <li>
            <strong>Dividend cross-check.</strong> For dividend payers, a dividend-discount value (cost of equity {pct(v.ddm.costOfEquity, 0)}) is blended in at {pct(v.ddm.weight, 0)}.
          </li>
          <li>
            <strong>Qualitative tilt.</strong> A small adjustment for strengths and weaknesses that do not show up in the numbers yet. It can shift growth by up to ±{pct(v.qualGrowthCap, 0)} points
            and the exit multiple by up to ±{pct(v.qualMultipleCap, 0)}, and its total effect on the target is capped at ±{pct(v.tiltCap, 0)}.
          </li>
        </ul>
        <p>
          The bear and bull cases move starting growth by ±{pct(v.scenario.growthShift, 0)} points and the exit multiple by ±{pct(v.scenario.peShift, 0)}. The waterfall on each company&apos;s How We Got Here
          tab shows exactly how much each part adds or subtracts, and the What-if Simulator runs the same calculation in your browser.
        </p>
      </section>

      <section id="m-qual">
        <h2>4. Qualitative factors</h2>
        <p>
          We score six factors from 0 to 100 using the text of the reports and recent company news: management, growth outlook, competitive position, risk profile, governance and sentiment. Each
          score comes with a one-line justification and the passages it was drawn from. A company with average scores (50) receives no tilt at all.
        </p>
      </section>

      <section id="m-conf">
        <h2>5. Confidence and the AutoVise Score</h2>
        <p>
          <strong>Confidence (0–100)</strong> tells you how much to trust the prediction itself. It rises with complete, long, stable and recent data and with factor scores that agree, and it falls when
          the bear and bull cases are far apart. Below 60 we show it in amber.
        </p>
        <p>
          <strong>The AutoVise Score (0–100)</strong> summarises the opportunity: {s.valuation.scoreWeights.upside}% upside to the base case, {s.valuation.scoreWeights.quality}% qualitative quality and{" "}
          {s.valuation.scoreWeights.confidence}% confidence. It is a way to sort companies, not a rating to buy.
        </p>
      </section>

      <section id="m-update">
        <h2>6. When predictions change</h2>
        <p>
          A prediction is recalculated whenever a report is approved, replaced or deleted, a share price or company event changes, or our analysts change a setting. The new draft is compared with the
          published version, and a reviewer approves it before it goes live{s.publishing.autoPublish ? ", unless the change is small and confidence is high" : ""}. Any manual override is recorded with a note,
          and every earlier prediction is kept for the track record.
        </p>
      </section>

      <section id="m-ai">
        <h2>7. How AI is used</h2>
        <p>
          We use Google&apos;s Gemini models for three jobs: reading reports to extract figures and commentary (which an analyst then checks), scoring the six qualitative factors within the caps above,
          and writing the pitch from the computed figures. The pitch is checked automatically — any number that does not appear in the computed figures or the cited report passages is rejected. The
          consultant chat answers only from the company&apos;s reports, figures and published pitch, and cites its sources.
        </p>
      </section>

      <section id="m-limits">
        <h2>8. What the model cannot see</h2>
        <p>
          The model only knows what is in the reports, the price history and the news our analysts enter. It does not anticipate takeovers, sudden regulatory changes, fraud or market-wide shocks. It is
          weakest for companies with short histories, volatile or negative earnings, or reports that are late. Treat every target as one informed view, not a forecast you can rely on.
        </p>
      </section>

      <div style={{ display: "flex", gap: 10, padding: "14px 16px", borderRadius: 12, background: "var(--subtle)", fontSize: 14, lineHeight: 1.6 }}>
        <Info size={18} style={{ flex: "none", marginTop: 2, color: "var(--muted)" }} aria-hidden />
        <span>
          {s.disclaimer.short} Read the <Link href="/disclaimer">full disclaimer</Link> before relying on anything you read here.
        </span>
      </div>
    </DocPage>
  );
}
