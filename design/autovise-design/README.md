# AutoVise — design handoff for Claude Code

This folder is the finished UI design for **AutoVise**, an AI investment-consultant web app. Build it as a real app. These files are the visual spec, not production code.

## Target stack
- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui-style components
- Recharts for charts, lucide-react for icons
- Fonts: Geist (UI) and Geist Mono (all prices and numbers, with tabular figures)

## What's in here
| Path | What it is |
|---|---|
| `BRIEF.md` | The original product brief. Every requirement is listed here. |
| `autovise.css` | **Source of truth for design tokens.** The light theme is on `.av`, the dark theme on `.av.dark`, and both use the same CSS variables (bg, surface, card, border, text, muted, primary, accent, pos, neg, warn, chart c1–c5, shadows, radius). Also has the component classes (btn, input, chip, pill, delta, meter, tabs, tbl, bubble, logo, co-card…). |
| `logos/` | Sample company logos (fictional), with `-dark` variants where one exists. |
| `screens/*.dc.html` | One source file per screen. They need the design canvas's runtime to render, so they show raw `{{…}}` text if opened directly in a browser. Read them as source instead: the markup is inside `<x-dc>`. The `<script type="text/x-dc">` block holds the sample data and the UI logic (filters, tabs, what-if maths, chat streaming, logo-tile rules). |
| `previews/` (optional) | PNG/PDF exports of the screens, if added. Use them as the visual reference. |
| `screens/canvas.json` | Index of every screen: its title, page group and size. |

Files named `*-dark`, `*-mobile`, `*-tablet`, `*-form`, `*-price`, `*-versions`, `*-delete`, `*-error*`, `*-uploading`, `Company-how/financials/whatif` and `Disclaimer` are thin wrappers that show a main screen in another theme, size or state. They contain no extra design, so read the main file instead.

## Screen → route map
| Main screen file | Route |
|---|---|
| `Main.dc.html` | `/` — companies grid, search, sector filter and sort |
| `Company.dc.html` | `/companies/[ticker]` — header, fan chart, tabs (Pitch / How We Got Here / Financials / What-if), chat panel (right side on desktop, bottom sheet below 1024px) |
| `Compare.dc.html` | `/compare` |
| `TrackRecord.dc.html` | `/track-record` |
| `Methodology.dc.html` | `/methodology` and `/disclaimer` (`doc` prop) |
| `Login.dc.html` | `/admin/login` |
| `Dashboard.dc.html` | `/admin` |
| `Companies.dc.html` | `/admin/companies` — table, create/edit drawer with the logo uploader and live preview, update-price dialog |
| `Reports.dc.html` | `/admin/companies/[ticker]/reports` — upload area, versions dialog, delete confirmation |
| `ReportReview.dc.html` | `/admin/reports/[id]/review` — PDF on the left, extracted data on the right |
| `Predictions.dc.html` | `/admin/predictions` |
| `Settings.dc.html` | `/admin/settings` |
| `ChatInsights.dc.html` | `/admin/chat-insights` |
| `Tokens.dc.html`, `Components.dc.html`, `Logos.dc.html`, `States.dc.html` | Reference sheets: tokens, the component library, the logo component spec, and loading / empty / error / toast / dialog states |

## Build order
1. Turn `autovise.css` variables into `app/globals.css` (`:root` = light, `.dark` = dark) and the Tailwind theme. Add the theme toggle (light / dark / system) with `next-themes`.
2. Shared components: Button, Input, Select, Switch, Slider, Tabs, Table, Dialog, Sheet, Toast, Badge/StatusPill, UpsideBadge, ConfidenceMeter, ScoreGauge, CitationChip, ChatBubble, **CompanyLogo**, CompanyCard. Match `Components.dc.html` and `Logos.dc.html`.
3. Public pages, then the `/admin` layout (collapsible sidebar and top bar), then the admin pages.
4. Put all sample data in one `lib/mock-data.ts`. Copy the companies, prices, targets, financials and track-record rows from the screens' scripts.

## Rules to keep
- **CompanyLogo:** sizes 32 / 48 / 96 (64 on mobile in the detail header). Use a 1px border and `object-contain`. Radius is `min(14, size × 0.25)`. Padding depends on logo shape (square 16%, round 14%, tall 10%, wide 7%). Tile background is light, dark or transparent. In dark theme use `logoDark` when it exists; if a transparent tile has no dark logo, switch it to a light tile. With no logo, show a monogram with 1–2 initials on a soft tint of the brand colour (`color-mix`). While loading, show a skeleton tile.
- **Numbers:** write the currency code before the price (`LKR 245.50`), give changes a sign and a true minus sign (`+18.4%`, `−8.0%`), and use tabular / mono figures.
- **Colour:** green/emerald means upside only, red/rose means downside and risk only, amber means warnings and low confidence only. Every change also gets a sign and an arrow, so colour is never the only signal.
- **Disclaimer:** show "Predictions are model estimates, not financial advice." wherever a prediction appears.
- **Accessibility:** WCAG AA contrast in both themes (contrast ratios are listed in `Tokens.dc.html`). Use real `<button>`, `<a>` and `<label>` elements.
- **Charts:** rebuild the SVG charts with Recharts. The price chart is a history line plus a bear/base/bull fan for years 1–3. The other charts are the valuation waterfall, the radar for qualitative factors, the dumbbell chart on Track Record, and the sparklines on the company cards.
