# Handoff: My Tree → My Part (contribution diary)

## Overview
A new feature in the Tuto kids' app. A child logs kind things they did to help — at home or out in the world (made their bed, set the table, helped a sibling, helped outside, or free-typed). A parent later **approves** each entry. The metaphor: every approved contribution grows a **leaf**; every month starts a **new tree**; over time the trees become a **forest** the child can look back on.

It is **one screen** delivered as **three age shells** (same layout & components; visual weight, tone and title shift by age) plus a **first-time intro** for the youngest band. No points/rewards/gems appear on this screen — rewards happen monthly, elsewhere.

## About the Design Files
The files in this bundle are **design references created in HTML/React-via-Babel** — prototypes that show intended look and behavior. They are **not production code to copy directly**. The task is to **recreate these designs in Tuto's real codebase** (the attached `tuto-app`) using its existing environment, component patterns, fonts, and conventions. Where this doc and the codebase's established patterns disagree on implementation detail (state libs, styling approach, routing), follow the codebase — match the *visual + behavioral* spec here, not the literal markup.

Open `My Tree.html` to see all four frames side by side. `Tree Growth Stages.html` is a reference board explaining the month-long growth model.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final-intent. Recreate the UI pixel-closely using the codebase's libraries. The phone bezel + status bar in the mock are presentation chrome only — do **not** build them; the app already renders inside a device/PWA shell.

## ⚠️ What is design vs. backend (do NOT invent a data layer)
The mocks fake these with local state. In the real app they are **backend / other-surface** concerns — implement the UI hooks, not a fake model:
- **Category** behind each card (self-care / household / family / outside) is data. Here it's only *hinted* by icon tint + a colour dot. **Never show category labels to the child.**
- **Free-text moderation/filtering** is backend. The free-text field is UI-only in these mocks.
- **Parent approval** happens in the parent app (Tuto Care). This screen only displays `pending` vs `approved` states pushed from there.
- **Streak / month rollover / forest archive** are server-derived.

## Screens / Views

### 1. First-time intro (Ages 6–8 only)
- **Purpose:** Tuto introduces what the tree is before the diary opens. Shown once.
- **Layout:** Full-height centered column on a green vertical gradient (`#EAF7EE → #D2EEDF`). Floating mascot (gentle 4.5s up/down bob) → white rounded card with copy → a "new tree every month" pill → bottom primary button.
- **Components:**
  - **Mascot** `TutoMascot size=130 expression="default"` (the friendly blob; default expression — *not* the dead-eyed one).
  - **Card:** white, radius 24, padding 20×22, shadow `0 16px 36px -14px rgba(45,80,40,.3)`. Title "Meet your tree! 🌳" Fredoka 600 / 20px. Body Nunito 700 / 14px / line-height 1.55, `--ink-soft`, with "leaf" emphasized in `--green-deep`.
  - **Pill:** "🌱 A new tree starts every month", weight 800 / 12px, `--green-deep` on `rgba(76,182,133,.14)`, radius 999.
  - **Button:** full-width, radius 20, padding 16, `--green` bg, white Fredoka 600 / 17px, shadow `0 10px 26px rgba(76,182,133,.42)`. Copy "Let's grow my tree! →". Leads into the 6–8 diary.

### 2. Ages 6–8 · "My Tree" 🌳 (primary — most polished)
- **Purpose:** Child sees their big growing tree and taps cards to log help.
- **Layout (top→bottom):** status area → header → large tree block → cream agenda page that fills remaining height.
- **Header:** title "My Tree 🌳" Fredoka 600 / 23px `--green-deep`; right: round avatar 42px (`--green-bg`, emoji).
- **Tree block:** `TreeArt size=186`, centered, with an overlapping pill below: "🌱 N leaves this month" (singular "leaf" at 1).
- **Cream agenda page** (`.paper`): radius 14, warm radial cream bg (`#FFFCF3 → #FBF5E7 → #F6EFDD`), inner left gutter shadow, faint horizontal rule texture. Header row `.ptab`: "TODAY" label (Fredoka 600 / 11px / tracked / uppercase / `--green-deep`) + right-aligned serif-italic date (Cormorant Garamond 600 / 19px).
  - **Entry rows** (existing log): 30px rounded category-tint chip + emoji, serif-italic label 16px, state line. See **Entry states** below. Dashed divider between rows.
  - **Suggestion cards** (`.sugrid`, 2-col grid, gap 9): label "Did you help today? Tap one 👇". Each `.scard`: off-white `#FFFDF7`, 1.5px rule border, radius 15, 32px tinted icon + Fredoka 500 / 12.5px label. Hover `translateY(-2px)` + shadow; active `scale(.97)`. Tapping adds an entry and **removes that card** (`.gone`: opacity 0 + scale .8). When all 4 used → "Wonderful day! 🌟".
  - **Free-text (secondary, small here):** dashed-border bar, "✏️ Did something else? Write it here", muted.
- **Cards lead; free-text is small/secondary** in this band.

### 3. Ages 9–11 · "My Tree" 🌳 (intermediate)
- **Purpose:** Same diary, more progress-aware. Tree shrinks; list grows.
- **Header:** title 20px + a **streak pill** top-right: "🔥 5-day streak" (weight 800 / 12px, `#d07b2e` on `rgba(232,154,57,.16)`).
- **Progress strip** (replaces the big tree): translucent white card, radius 20. Left: `TreeArt size=92 target=18` (~half weight). Right: "N leaves grown" Fredoka 600 / 15px + a **progress bar** (height 9, radius 999, track `rgba(55,160,111,.18)`, fill gradient `#6BBF59 → #4cb685`, width = count/goal, transition .5s). Goal = **18**.
- **Agenda page:** same cream page. Suggestion cards become **full-width text-forward rows** (icon + label + "+"), stacked (gap 8), not a 2-col grid. Free-text bar is solid-bordered (slightly more present than 6–8).

### 4. Ages 12–15 · "My Part" 💪 (mature, list-centric)
- **Purpose:** A clean contribution log. Must **not** feel childish.
- **Background:** neutral `#F5F7F4 → #EAEFEA`. Mature palette: `--slate #27332c`, `--slate-soft #6c7c72`, `--moss #2f8f6b`, lines `#E0E6E1`.
- **Header:** title "My Part 💪" Fredoka 600 / 22px `--slate`. Right: tiny **`Sprig size=26`** (abstract sprig, *not* a cartoon tree) + month count (`--moss` 16px) over "THIS MONTH" micro-label. This is the *only* tree presence.
- **Free-text is PROMINENT here, at the top:** white input row "What did you do to help?" (Fredoka 500 / 13.5px) + a 48px `--moss` send button "↑".
- **Quick-add chips:** "Quick add" label + pill chips (one per unused category): white, 1.5px line border, radius 999, 7px colour dot + short label ("Made my bed", "Set the table", …). Tapping logs an entry.
- **Contribution list = center of screen:** grouped by day ("Today · {date}", "Yesterday"). Each `MatureRow`: 9px category dot + label (Fredoka 500 / 14.5px `--slate`) + sub ("Approved" / "Sent for approval") + right **status pill** ("Approved" green `#E2F0E9/--moss` · "Pending" amber `#FBEFD8/#b9892f`).

## Entry states (shown in every band)
- **pending** — amber/striped check, sub-text **"Waiting for approval"** (mature: "Sent for approval", pill "Pending"). Appears the instant the child adds an entry.
- **approved** — solid `--green` check + shadow, sub-text **"Approved"** (mature pill "Approved"). Pushed from the parent app.
Both states must be visually distinct and both visible in the default mock data.

## Add-entry micro-moment
On add: a bottom **confirmation toast** (`.micro`) slides up (translateY 140%→0, cubic-bezier(.2,.9,.3,1.2), ~.42s) with a small mascot + a warm line, auto-hides ~3.4s. Copy by band: 6–8 "Nice! I'll check this with your parent 🌱" · 9–11 "Logged it! Your parent will confirm soon 🌱" · 12–15 "Logged — your parent will confirm it." **No points/gem/reward language at this moment.** New rows pop in (`tt-pop`, scale .7→1, .42s).

## Tree growth model (see `Tree Growth Stages.html`)
Growth tracks **approved leaves, not the calendar** — action grows the tree; missed days never shrink it.
- **Four silhouettes**, with size easing **continuously** between them (CSS transform transition .7s `cubic-bezier(.22,1,.36,1)`):
  1. **Sprout** (0–1 leaf) — a shoot from the soil (`_Sprout`, no trunk/canopy).
  2. **Sapling** (~⅓ of target) — slim trunk, few leaves.
  3. **Young tree** (~⅔) — canopy filling.
  4. **Full tree** (100% of target).
  5. **In bloom** (past target, month-end) — extra contributions render as pink blossom (`bloom` prop), then the tree joins the forest at rollover.
- **Monthly targets (= full tree):** 6–8 → **12**, 9–11 → **18**, 12–15 → **24** leaves.
- **Soft daily cap (~2 leaves/day)** so a child can't max the tree in one day; extra entries still log + celebrate.
- `TreeArt`: `scale = 0.34 + 0.66 * clamp(fruits/target)`, anchored at the soil so it stays planted while growing. Leaf dots fill 8 fixed canopy slots, cycling the 4 category accent colours.

## Interactions & Behavior
- Tap suggestion card / quick-add chip → optimistic `pending` entry prepended to today, card consumed (6–8/9–11), tree leaf-count +1, toast shown.
- Free-text → opens an input (mock is static); on submit behaves like a card add but with the typed label (server moderates).
- Approval state transitions arrive from the parent app (no child action).
- Mobile-first PWA, portrait. Lists scroll; scrollbars hidden.
- Respect `prefers-reduced-motion` (mock gates the mascot bob on it).

## Design Tokens
**Feature green:** `--green #4cb685`, `--green-deep #37a06f`, `--green-bg #DCF2E7`. **Foliage:** `--leaf #6BBF59`, `--leaf-deep #4FA84A`, `--bark #A9744F`. **Ink:** `--ink #241f3a`, `--ink-soft #8d83ad`.
**Category accents (icon tint / dot only — never labelled):** self-care `#5aa9e6`/bg`#E4F1FC` · household `#e89a39`/bg`#FBEFD8` · family `#ef7d9d`/bg`#FBE4EC` · outside `#54b487`/bg`#DEF2E7`.
**Cream agenda:** `--cream #FBF5E7`, `--cream-2 #F6EFDD`, paper ink `#4a3f2e`, rule `#E7DABF`.
**Mature (12–15):** `--slate #27332c`, `--slate-soft #6c7c72`, `--moss #2f8f6b`, paper `#F3F5F2`, line `#E0E6E1`.
**Type:** Fredoka (400–700) for UI/headings; Nunito (600–900) for body; Cormorant Garamond (italic 500/600) for agenda dates. **Radii:** cards 14–24, pills 999, chips 9–15. **Phone frame radius/shadow is chrome — ignore.**

## Assets
- **`TutoMascot`** — the existing "Tuto the blob" mascot (chunky ink outline). Use the app's real mascot component; `tuto-mascot.jsx` here is a preview copy. Expressions used: `default` (intro), `proud`/excited variants in toast.
- **`TreeArt` / `Sprig`** (`tree-art.jsx`) — original SVGs authored for this feature; port to the codebase (inline SVG or component). No external image assets. Emoji are used as inline icons (🌳🛏️🍽️🤝🌿✏️) — keep or swap for the app's icon set.

## Files
- `My Tree.html` — entry point; renders all four frames in a rail (`MyTreeHandoff`).
- `my-tree.jsx` — all four frames, the `useDiary` state hook, shared rows/cards/toast. Mock data only.
- `tree-art.jsx` — `TreeArt` (growth-staged tree, `fruits`/`target`/`bloom`) + `Sprig` (12–15 indicator).
- `tuto-mascot.jsx` — preview copy of the existing mascot.
- `Tree Growth Stages.html` — visual reference for the 30-day growth model (sprout → bloom + the rules).
