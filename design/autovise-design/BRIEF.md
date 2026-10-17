Design a complete UI for "AutoVise", a web app that acts like an AI investment consultant. Visitors browse listed companies, see each one's current share price and a predicted share price for the next 3 years, then open a company to read a consultant-style "pitch": what the prediction is, how it was calculated and why. They can also ask an AI chatbot follow-up questions, like the Q&A after a pitch. Admins manage companies and upload financial reports that feed the predictions.

Build it in Next.js with Tailwind CSS and shadcn/ui-style components, using Recharts for charts and lucide icons.

BRAND AND FEEL
- Calm, trustworthy, premium. Think private-bank research desk, not a crypto trading app. Clean, plenty of white space, data-dense where it matters.
- Primary colour: deep navy/indigo for trust. Accent: emerald/teal for positive and "upside". Use red/rose only for downside and risk, and amber for warnings and low confidence.
- Typography: a modern sans (Inter or Geist) for UI; tabular/monospace figures for all prices and numbers so columns line up.
- Logo idea: wordmark "AutoVise" with a small upward-trend or compass mark.

THEMES (required)
- Full light and dark themes built from the same design tokens (CSS variables for background, surface, card, border, muted text, primary, accent, positive, negative, warning, chart-1..5).
- Light: off-white background, white cards, subtle borders and soft shadows.
- Dark: near-black/slate background (not pure black), slightly lighter cards, no heavy shadows, and gain/loss colours tuned to stay readable and accessible on dark.
- Theme toggle in the header (light / dark / system). Charts, badges and tooltips must look right in both themes.
- WCAG AA contrast in both themes.

PUBLIC SCREENS
1. Home / Companies
   - Header: logo, nav (Companies, Compare, Track Record, Methodology), theme toggle.
   - Short hero: "Investment research, pitched like a consultant", plus a search bar.
   - Filter bar: search, sector dropdown, sort (Highest upside, Confidence, Name).
   - Responsive grid of company cards. Each card shows: logo, company name, ticker, sector chip, current price with date updated, 3-year predicted (base) price, upside % badge (green up / red down), confidence meter (0–100), a small sparkline of price history plus a dotted projection, and "Prediction pending" or "Outdated data" states.
   - Footer with a short investment disclaimer.

2. Company detail ("The Pitch")
   - Header: logo, name, ticker, sector, current price, 3-year target, upside %, AutoVise Score (0–100 gauge), confidence and "last updated from reports dated…".
   - Main chart: historical price line plus a projected fan for years 1–3 with bear/base/bull bands and labelled year markers.
   - Tabs:
     a) "The Pitch": consultant narrative in sections: Investment Thesis, Key Drivers, Valuation Walkthrough, Risks, Catalysts, What Would Change Our View. Each claim can carry small citation chips ("Annual Report 2025, p.34") that open a source preview.
     b) "How We Got Here": valuation waterfall (current price → earnings growth effect → multiple change → qualitative adjustment → target), assumptions table (growth rate, P/E now vs exit, sector benchmark), a radar chart of 6 qualitative factor scores (management, growth outlook, competitive position, risk, governance, sentiment), each with a one-line justification, and a ratios table.
     c) "Financials": multi-year table (revenue, net income, EPS, margins, ROE, debt/equity, dividends) with small trend arrows, plus a list of source reports with type, period and version.
     d) "What-if Simulator": sliders for EPS growth, exit P/E and qualitative tilt, with the 3-year projection and target updating live, and a "reset to AutoVise base case" button.
   - Chat panel "Ask the consultant": a right-side panel on desktop and a bottom sheet on mobile, with 4 suggested question chips, streamed answers with typing state, source citation chips under answers, thumbs up/down, and a small "Not financial advice" note.

3. Compare: up to 3 companies side by side (price, target, upside, confidence, score, key ratios, factor radar overlay).
4. Track Record: table and chart of past predictions against actual prices, plus a hit-rate summary.
5. Methodology and Disclaimer: clean long-form reading pages.

ADMIN PANEL (/admin)
- Login page (email + password), centred card.
- Layout: collapsible left sidebar (Dashboard, Companies, Reports, Predictions, Sectors, Events, Chat Insights, Settings, Users, Audit Log), top bar with user menu and theme toggle.
- Dashboard: KPI tiles (companies, reports processing, failed jobs, predictions awaiting review, chats today), processing queue list with status pills (Uploaded, Processing, Needs review, Approved, Failed, Superseded), and stale-price warnings.
- Companies list: table with search, status (Draft/Published), price, last updated and actions. Create/edit company form (name, ticker, sector, logo upload, description, website, currency, shares outstanding) and a "Update price" dialog with price history and CSV import.
- Company → Reports: drag-and-drop upload area (PDF/Excel, multiple files), reports table with type, fiscal period, version number and status, plus a "Replace file" action that opens version history and a delete confirmation explaining that the prediction will be recalculated.
- Report review: split screen with a PDF viewer on the left and extracted data on the right. The right side has two parts: a quantitative metrics table with inline edit and page references, and a list of qualitative insights (category, summary, sentiment, impact, quote). Approve / Re-extract buttons.
- Predictions: draft against published comparison (old vs new targets, changed assumptions highlighted), with Publish, Rerun and "Add override note" actions.
- Settings: valuation weights and caps as sliders/number inputs, auto-publish toggle, disclaimer text.
- Chat Insights: top questions list, answers marked down-voted, filter by company.

STATES AND DETAILS
- Design loading skeletons, empty states (no companies yet, no reports uploaded), error states, toasts, and confirmation dialogs.
- Responsive: desktop (1440), tablet (768) and mobile (390). On mobile the cards stack, tabs scroll horizontally, and chat becomes a bottom sheet.
- Number formatting: currency code before the price (for example LKR 245.50), and percentages with a sign (+18.4%).
- Show a subtle disclaimer wherever a prediction appears: "Predictions are model estimates, not financial advice."

DELIVERABLES
- A design-token sheet (colours for both themes, type scale, spacing, radius, shadows).
- A component library page: buttons, inputs, badges/status pills, upside badge, confidence meter, score gauge, company card, citation chip, chat bubble, table, tabs, dialog, toast.
- All screens above in both light and dark themes.