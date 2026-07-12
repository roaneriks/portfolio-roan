# Roan Eriks — Portfolio Website · Project Brief

This file is the source of truth for the project. Read it at the start of every session before writing any code.

---

## What we're building

A personal portfolio website for **Roan Eriks**, a designer who bridges industrial product design and business/strategic design. Multi-page, static site. Built to be learned from as it's built — explain choices, keep code readable.

---

## Positioning

The through-line for all copy and design: *an industrial product designer who moved into business and strategic design — someone who can both make the thing and shape the strategy behind it.* Tone: confident, clear, editorial. Not corporate, not over-written.

---

## Personal details

- Roan Eriks — Barcelona
- roan.eriks@gmail.com · +31 6 36299060
- LinkedIn: /RoanEriks
- Master in Business Design — Elisava (2025–2026)
- BSc Industrial Product Design — Hanze University Groningen (2019–2023)

---

## Design system

### Colour palette
| Role | Hex | Usage |
|---|---|---|
| Base | `#FAFAF8` | Page background everywhere |
| Text | `#0B0B0B` | Titles, body copy |
| Accent | `#1E3A5F` | Links, project numbers, hover states, tags — used sparingly |
| Surface | `#E9E9E6` | Tiles, dividers, hairline borders, card backgrounds |
| Secondary text | `#5A5A57` | Captions, descriptors, metadata |

### Typography
| Role | Face | Weight | Size range | Notes |
|---|---|---|---|---|
| Display | Clash Display | 600 | 38–72px | Hero, project titles, section headers |
| Body | General Sans | 400 | 15–17px | Paragraphs, case study copy |
| Label | General Sans | 500 | 13–15px | Nav links, metadata, tags |
| Mono | Space Mono | 400 | 11–18px | Project numbers and metadata only — always in `#1E3A5F` |

**Sources:** Clash Display + General Sans via Fontshare (self-host files). Space Mono via Google Fonts.
**Weights used:** 400 and 500/600 only. Never 700+.

### Spacing & layout
- Max content width: 1400px, centred
- Page padding: 32px horizontal
- Base spacing scale: 8px unit (8 / 16 / 24 / 32 / 48 / 64 / 96px)
- Borders: `0.5px solid #E9E9E6` throughout

---

## Tech stack

- **Vanilla HTML + CSS + JavaScript.** No framework to start.
- Motion: **Lenis** (smooth scroll) + **GSAP** (scroll reveals, nav transition, snap behaviour) — added ONLY after base layout and responsive are complete.
- CSS custom properties for all design tokens — defined at the top of the stylesheet before any components.
- Mobile-first responsive. Semantic HTML. Accessible: alt text, visible focus states, AA colour contrast.
- Deploy: **Vercel** via git push.

---

## Sitemap

```
/                          Homepage
/projects                  Projects index
/projects/ikea-hej         Case study
/projects/trends-report    Case study
/projects/dutch-climate    Case study
/projects/japandi-table    Case study
/playground                Playground
/about                     About
/contact                   Contact
```

Shared nav on every page. No shared footer needed for now.

---

## Page specs

### Shared nav

**Default state (at top of page):**
- Centred pill, light background, logo mark "RE" in Space Mono left, links right: Projects · Playground · About me · Let's talk
- Sits flush at the top of the hero

**Scrolled state (on scroll, smooth animated transition):**
- Compact floating pill, solid background, same links remain visible
- Stays sticky at the top as user scrolls
- Transition: smooth morph animation triggered on scroll start

---

### Homepage `/`

**Hero — 100vh full screen**
- Oversized stacked Clash Display title, left-anchored, ~3 lines
- Top-right: catchphrase block + contact email, vertically aligned to middle of title
- Hero fills full viewport height on load. Projects begin below the fold.

**Featured projects — checkerboard, full-screen snap scroll**
- Four projects, each panel is 100vh
- Alternating layout per panel: text-left/photo-right → photo-left/text-right → repeat
- Text tiles on `#FAFAF8`, photo tiles on `#E9E9E6`
- Project text (number in Space Mono + title in Clash Display + one-line descriptor) anchors to bottom of tile
- CSS scroll-snap: one project panel on screen at a time, never half-and-half. Start with `scroll-snap-type: y mandatory`, tune to `proximity` if it feels heavy on trackpad.
- Image hover: subtle scale `1.0 → 1.03`, slow ease

**Project order on homepage:**
1. IKEA Hej — Future of loyalty & engagement
2. Dutch Climate Systems — Project management & product innovation
3. Trends Report — Strategic foresight for retail
4. Japandi Table — Self-assembly furniture design

---

### Projects index `/projects`

- Page header: large "Projects" in Clash Display, right-aligned count + date range in Space Mono, filter bar
- **Two-column grid** — scales gracefully as more projects are added
- Filter bar (top right of header): All · Strategy · Research · Product — functional JS filter from day one
- Each card: thumbnail (fixed height, `object-fit: cover`), project number overlaid top-left in Space Mono navy, title in Clash Display, one-line descriptor in General Sans, tags in Space Mono navy, arrow bottom-right
- Hover: subtle background shift on card
- Arrow appears on hover

**Project order:**
1. IKEA Hej — tags: Strategy, Service Design
2. Trends Report — tags: Research, Foresight
3. Dutch Climate Systems — tags: Management, Product
4. Japandi Table — tags: Product Design, Craft

---

### Project case study `/projects/[slug]`

Shared template for all four case studies.

**Structure:**
1. Nav (shared)
2. Hero block — project number in Space Mono, large title in Clash Display, one-line descriptor, metadata strip (Role · Context · Year · Type) in Space Mono
3. Full-bleed hero image — 16:9, edge to edge, no margin
4. Intro paragraph — max-width 640px, left-aligned, punchy "so what"
5. Content blocks — alternating: full-width image below text / two-column text+image / reverse. Each project dictates its own mix.
6. Next project strip — minimal footer row, "Next project" label in Space Mono, project title in Clash Display, arrow right

**Imagery within case studies:**
- Hero image: full bleed, 16:9
- Detail images: contained within content column, freeform ratio

**Case study content:**

*01 IKEA Hej*
- Role: Business Designer · Context: Elisava × IKEA Xplore Studio · Year: 2025–2026 · Type: Strategy, Service Design
- About: Social mode feature for the IKEA app connecting Gen Z shoppers based on mood and shared interests. Addresses the loneliness crisis and IKEA's Gen Z engagement gap (85% don't use the app).
- Sections: Research (Wall of Evidence, street interviews) → Five core trends → IKEA Hej concept → Multiverse Game presentation

*02 Trends Report*
- Role: Business Designer · Context: Elisava × IKEA Xplore Studio · Year: 2025–2026 · Type: Research, Foresight
- About: Strategic trend report on the future of loyalty and engagement in retail. Environmental scan → Wall of Evidence → Futures Wheels → five core trends packaged as a creative booklet.
- Trends: HCD Faces MCD · Create to Survive · Abstinent Self · Mood-Adaptive Living · Synthetic Confidence

*03 Dutch Climate Systems*
- Role: Project Manager · Context: Dutch Climate Systems (startup) · Year: 2024–Current · Type: Management, Product
- About: Managed installations end to end. Surveying, technical drawings, supply ordering, stakeholder communication. Also involved in R&D and communication materials. School project: adapted ICECUBE for residential bedroom use.
- Flagship product: ICECUBE — 80% less energy, no Freon, dew point cooling.

*04 Japandi Table*
- Role: Product Designer · Context: MI Studio, Amsterdam · Year: 2023 · Type: Product Design, Craft
- About: Screwless self-assembly table set using cross lap joint — seven planks, no screws or glue. Japandi aesthetic: rounded shapes, light oak, harmony and balance. Comes with a user manual.

---

### Playground `/playground`

- Page header: "Things I make when no one's watching" — set in Clash Display, large, left-aligned
- **Masonry grid** — Claude Code decides tile sizing freely. Different aspect ratios, no enforced uniformity. Feels like a sketchbook, not a CV.
- Each item: visual (image/screenshot), one-line title, 1–2 sentence note on what it is or why it exists. No formal metadata strip.
- Tone: personal, curious, lighter than the main projects. No tags required.

**Placeholder content (replace with real assets later):**
1. Vibe code project
2. Organising Claude Code class
3. T-shirt design

---

### About `/about`

Three sections:
1. Portrait photo — full bleed at top
2. Personal paragraphs — who Roan is, Groningen → Barcelona journey, what drives him. More human than the resume bio.
3. Skills/education strip — highlights only, clean layout. Not a full CV.

Placeholder copy until Roan provides final text.

---

### Contact `/contact`

- Large Clash Display heading: "Let's talk"
- One framing line in General Sans (placeholder: "Open to strategy, design, and product work")
- Email as mailto link: roan.eriks@gmail.com
- LinkedIn: /RoanEriks

---

## Imagery treatment summary

| Location | Treatment |
|---|---|
| Homepage checkerboard tiles | Fixed height, `object-fit: cover`, scale `1.0→1.03` on hover |
| Projects index thumbnails | Fixed height, `object-fit: cover`, consistent across all cards |
| Project page hero | Full bleed, 16:9, no overlay or filter |
| Case study detail images | Contained within content column, freeform ratio |

---

## Build order

Build in this sequence. Deploy early and often.

1. Scaffold — folder structure, shared nav, CSS tokens file, all placeholder pages
2. Homepage — hero, then checkerboard (static first, snap + nav animation in motion phase)
3. Project page template — one template, four pages inherit it
4. Projects index — grid + filter
5. About + Contact
6. Playground — masonry grid
7. Motion phase — Lenis + GSAP: nav morph on scroll, scroll-snap on homepage panels, subtle hover effects
8. Responsive pass
9. Deploy to Vercel

---

## Analytics (added July 2026)

Anonymous visitor tracking with Supabase + a private dashboard at `/admin`.
Setup steps for a fresh environment: see `SETUP-ANALYTICS.md`.

**Architecture** — no credentials in the browser, database locked to public:
- `js/analytics.js` (every page) → beacons events to `/api/track`
- `api/track.js` (Vercel function) inserts into Supabase with the secret key
  and adds country/region/city from Vercel's geo headers (no IPs stored)
- `api/stats.js` returns events to the dashboard, gated by the
  `x-admin-key` header checked against `ADMIN_PASSWORD`
- `admin.html` + `css/admin.css` + `js/admin.js` — dashboard (demo mode:
  `/admin?demo=1`). Chart marks use a colorblind-validated pair
  (`#2F6CB3` / `#B4552D`), not the brand navy — navy is too dark for data marks.
- `supabase/setup.sql` — single `events` table, RLS enabled with no policies

**Env vars (Vercel):** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_PASSWORD`

**Gotchas discovered while building:**
- The homepage never scrolls natively (GSAP slides `.snap-container`), so the
  tracker reads the container's `-translateY` for click positions and scroll
  depth — don't switch it back to plain `pageY`/`scrollY`.
- Opening `/admin` sets `pf_notrack` in localStorage; that browser is then
  excluded from tracking. Clear the key to test tracking locally
  (localhost also needs `?track=1`).
- The click-map iframe freezes `100vh` sections via injected CSS — an iframe
  sized to its own `scrollHeight` otherwise feeds back (panels grow forever).

---

## Working rules for Claude Code

- Define all CSS custom properties (tokens) before writing any component styles
- Do not add motion or animation until base layout and responsive are complete
- Explain choices as you go — this is a learning project
- Ask before making brand decisions not covered in this brief
- Use placeholder images (`background: #E9E9E6`) wherever real assets are missing
- Self-host Clash Display and General Sans font files — do not load from Fontshare API in production
- Space Mono can load from Google Fonts
- Build one page at a time, confirm before moving to the next
