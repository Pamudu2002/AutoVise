import type { Metadata } from "next";
import { DocHeader, DocPage } from "@/components/doc-page";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Disclaimer", description: "Please read this before using any prediction, pitch or chat answer on AutoVise." };

const TOC: [string, string][] = [
  ["#d-advice", "Not financial advice"],
  ["#d-reco", "No recommendation"],
  ["#d-model", "Model estimates can be wrong"],
  ["#d-chat", "The AI consultant"],
  ["#d-data", "Data and prices"],
  ["#d-contact", "Contact"],
];

export default async function DisclaimerPage() {
  const s = await getSettings();
  return (
    <DocPage active="disclaimer" toc={TOC}>
      <DocHeader eyebrow="Disclaimer" title="Disclaimer" lead="Please read this before using any prediction, pitch or chat answer on AutoVise." />
      <section id="d-advice">
        <h2>Not financial advice</h2>
        <p>
          AutoVise provides general research for information and education. It does not take your objectives, financial situation or needs into account, and nothing on this site is personal
          financial, investment, tax or legal advice.
        </p>
      </section>
      <section id="d-reco">
        <h2>No recommendation</h2>
        <p>Targets, scores and pitches are not recommendations to buy, sell or hold any security. Consult a licensed investment adviser before making an investment decision.</p>
      </section>
      <section id="d-model">
        <h2>Model estimates can be wrong</h2>
        <p>
          Predictions are produced by a model from company reports and price data. They may be inaccurate, incomplete or out of date, and actual prices can fall outside the published range. Past
          accuracy, including figures shown on the Track Record page, does not guarantee future results.
        </p>
      </section>
      <section id="d-chat">
        <h2>The AI consultant</h2>
        <p>
          Chat answers are generated automatically and may contain errors. Check the cited source before relying on any figure. Questions you ask are stored without your name and may be reviewed in
          aggregate to improve answers; do not share personal financial details in the chat.
        </p>
      </section>
      <section id="d-data">
        <h2>Data and prices</h2>
        <p>Share prices may be delayed. Financial data is taken from published reports and may be restated by the company after we process it.</p>
      </section>
      <section id="d-contact">
        <h2>Contact</h2>
        <p>Questions about this disclaimer can be sent to the AutoVise research desk through the contact details published by the site operator.</p>
      </section>
      <p style={{ fontSize: 14, color: "var(--muted)" }}>{s.disclaimer.long}</p>
    </DocPage>
  );
}
