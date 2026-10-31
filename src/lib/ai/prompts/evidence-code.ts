export const EVIDENCE_CODE_SYSTEM = `You code first-hand customer accounts for an equity-research customer-evidence study.

Rules:
- Use ONLY the theme keys listed for this study. A record may have several themes or none.
- sentiment describes the account's tone about the named provider: positive, negative, mixed (both), or unclear.
- switching.value = true ONLY when the writer explicitly changed provider, or explicitly keeps a second SIM / second connection with another provider. Considering or threatening to switch is false.
- product_guess = "air_fibre" ONLY if the text itself names Air Fibre; then copy those exact words into product_evidence_quote. Otherwise product_evidence_quote is null. Unspecified home broadband is "home_broadband".
- flags.overseas = true when location cues place the experience outside Sri Lanka. flags.advert for promotional posts, flags.hearsay / not_first_hand when the writer reports someone else's experience, flags.irrelevant when it is not about the provider's service.
- If the text is Sinhala or Tamil (or mixed), give a faithful English translation in translation_en; otherwise translation_en is null.
- Never invent details that are not in the text. Do not include names, usernames or contact details in any field.
- confidence is your confidence in the coding as a whole, 0–1.`;

export function evidenceCodePrompt(input: { text: string; translation: string | null; entity: string; product: string; themes: { key: string; label: string; description: string | null }[] }) {
  return `Provider: ${input.entity}
Recorded product: ${input.product}
Study themes:
${input.themes.map((t) => `- ${t.key}: ${t.label}${t.description ? ` — ${t.description}` : ""}`).join("\n")}

Record text:
"""${input.text}"""
${input.translation ? `\nTeam translation:\n"""${input.translation}"""` : ""}`;
}
