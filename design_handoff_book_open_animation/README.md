# Handoff: Book-Open Animation + Flipping Reading Book

## Overview
Two related motion pieces for the Tuto kids app:

1. **Open-on-tap transition** — when a child taps a story (or book) cover in **My Stories / Library**, the cover swings open like a real book and reveals the page underneath. For a *story*, the revealed page shows the child's own transcribed writing set in book type.
2. **Flipping reading book** — the "Reading your story…" evaluating screen replaces the still mascot with a 3D book whose pages turn continuously while Tuto reads beside it.

Reference inspiration: the Dribbble "History" library-open animation. Implemented entirely in CSS/SVG 3D — no image assets, no libraries.

## About the Design Files
The file in this bundle (`Book Opening Animation.html`) is a **design reference created in HTML** — a working prototype showing the intended look and motion, **not production code to paste in**. The task is to **recreate this behavior inside the existing Tuto React codebase** (Vite + React, plain inline-style components) using its established patterns — not to ship the HTML.

The prototype is interactive: open it and tap any cover to see the open transition; the right phone shows the looping reading animation.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, timing, and easing are all specified below and match the app's existing visual system (`StoryCover.jsx`, the gentle-spelling editor in `StoriesScreen.jsx`). Recreate pixel- and timing-faithfully using the codebase's existing fonts and tokens.

---

## Where this plugs into the existing codebase

| Piece | File(s) today | What changes |
|---|---|---|
| Cover composition | `src/components/StoryCover.jsx` | No visual change — the opening cover **reuses this exact composition** (color + title + image panel + byline). Factor the inner markup so it can render both as a static card and as the swinging "cover" face. |
| Tap → open | `src/screens/LibraryScreen.jsx` (`StoryCover … onTap`, `BookCard onTap`), `src/screens/StoriesScreen.jsx` (My Stories grid) | Today `onTap` navigates straight to the story editor. Insert the **open animation as a transition** that plays first (≈1.05s), then continues to the reading/edit view. |
| Revealed reading page | matches the **gentle-spelling editor** styling already in `StoriesScreen.jsx` (Lexend body, Fredoka One title, green theme, notebook spine) | The page under the cover renders `story.corrected_text` (fallback `transcribed_text`) in that book type. |
| Flipping reading book | `src/screens/StoriesScreen.jsx` step `'evaluating'`; also standalone `Stories Reading Animation.html` | Replace the static `<TutoMascot expression="thinking">` block with the flipping-book + Tuto composition. |

Data already available (no schema change):
- **Story**: `title`, `corrected_text` / `transcribed_text`, `cover_color`, `cover_url` (uploaded photo, nullable), `gems_earned`, `status` (`in_progress` shows the "In Progress" ribbon), plus `child.name` / `child.age` for the byline.
- **Book** (other authors): `cover_url`, `title`, `current_page`, `completed`. Books have no child writing inside — opening one reveals the cover/reading-progress, not story text.

---

## Screens / Views

### 1 · My Stories shelf (cover grid)
- **Purpose**: child browses their stories; tapping one opens it.
- **Layout**: 3-column grid, `gap: 14px`, `align-items: end`; a thin "shelf" board under each row (`height: 12px`, gradient `#fff → #f3ecfd`, radius `0 0 6px 6px`, soft drop shadow). A faint `tuto` watermark sits behind the grid (Baloo 2 800, ~78px, white, `opacity: .55`).
- **Cover card** (this is `StoryCover`): `aspect-ratio: 2/3`, `border-radius: 6px 12px 12px 6px`, bg = `cover_color`. Inner column:
  - Left **spine**: 5px wide, `rgba(0,0,0,.16)`, full height (`::after`).
  - **Title** (top): Baloo 2 800, 10.5px, color `#1A2E0A`, centered, `-webkit-line-clamp: 2`, padding `1px 10px 5px`.
  - **Image panel** (middle, `flex: 1`): radius 7px, bg `rgba(0,0,0,.07)`; if `cover_url` → `<img object-fit:cover>`, else a centered ✏️ (22px).
  - **Byline** (bottom): "by {name}", Fredoka 700, 8px, `rgba(26,46,10,.5)`.
  - **Tag**: gem chip `⭐ {gems_earned}` bottom-right (bg `#FFD93D`, text `#1A1A2E`); or `In Progress` ribbon when `status==='in_progress'` (bg `#FF6B35`, white).
  - Hover: `translateY(-4px)` + deeper shadow; active: `translateY(-1px) scale(.98)`.

### 2 · Open transition + revealed reading page
A full-screen overlay (over the phone frame) with bg `linear-gradient(180deg,#F4EFFF,#E7DBFB)`, a faint `story` watermark, and a close ✕ (top-left, 38px white circle).

**The 3D book** (`perspective: 1700px`, `perspective-origin: 50% 46%`):
- Container `book3d`: `250×348px`, `transform-style: preserve-3d`, resting `rotateX(2deg)`.
- **Reading page** (`readpage`, under everything): absolute fill, bg `#fff8ef` (`--paper`), `border-radius: 5px 13px 13px 5px`, inner-left shadow for the gutter + a 22px drop shadow. `padding: 24px 22px 26px 30px`, `overflow: hidden`. Left edge has a 9px **page-spine** gradient (`rgba(120,90,60,.22)→.04`). Contents:
  - **Title**: `Fredoka One`, 21px, `#2f9e6b`, line-height 1.12.
  - **Byline**: "by {name}, age {age}", Fredoka 600, 11px, `#6dbf94`.
  - **Body**: `story.corrected_text`, `Lexend` 400, 13px, line-height 1.78, color `#1a3d2b`, `white-space: pre-wrap` (preserve paragraph breaks).
  - **Page number**: Fredoka 600, 11px, `#c2cfc7`, centered at bottom.
- **Two flipping leaves** (`leaf1`, `leaf2`): paper-colored single panels above the page (motion only — they flip and fade out).
- **Cover** (`cover-l`, top, `z-index: 5`): the `StoryCover` composition (color + title + image/✏️ + byline) — the face that swings open.

### 3 · "Reading your story…" — flipping book (evaluating screen)
- bg `linear-gradient(180deg,#F4EFFF,#E7DBFB)`, centered column.
- **Open book** tilted in 3D (`perspective: 1500px`; book `rotateX(34deg)`): two static paper pages (`120×160` each) + center spine; **4 leaves** flip right→left on a continuous staggered loop.
- **Tuto mascot** (SVG, purple `#a98ce6`) below, gentle bob + slow blink + 3 rising ✨/⭐ sparkles.
- Caption: "Reading your story…" (Baloo 2 800, 21px, `#8a6bd4`) with animated `…`, plus "Just a moment!" sub.

---

## Interactions & Behavior

**Open transition** (driven by toggling a `show` class on the overlay; replay by removing the class, forcing reflow, then re-adding on the next frame):
- Cover + leaves run a single keyframe `swingOpen`, hinged on the **left edge** (`transform-origin: left center`), `1.05s cubic-bezier(.4,.05,.2,1) forwards`, staggered: cover `0s`, leaf1 `.16s`, leaf2 `.32s`.
- `swingOpen`: `rotateY(0) → rotateY(-158deg)` while `translateZ(6px)`; **opacity holds at 1 until ~82%, then fades to 0** by 100%. This single-sided + opacity-gate is deliberate — it guarantees the mirrored back face of the cover never shows (don't rely on `backface-visibility`; the page renderer/3D flattening makes it unreliable). The reading page sits underneath and is revealed as the cover clears.
- After the swing completes you continue to the real reading/edit screen (or simply leave the page shown). ✕ removes `show` to return to the shelf.

**Flipping reading book**: each leaf `@keyframes pageturn { 0%{rotateY(0)} 100%{rotateY(-180deg)} }`, `2.6s ease-in-out infinite`, delays `0 / .65 / 1.3 / 1.95s`, descending `z-index` so they stack correctly.

**Reduced motion** (`@media (prefers-reduced-motion: reduce)`): the open animation is disabled and the cover/leaves snap to `opacity: 0` (book shown already open); the flipping/bob/blink/sparkle loops are turned off and art is left in a resting state. Always make the *resting* state the readable one so print/PDF/reduced-motion never show a pre-animation blank.

## State Management
- `openStory` (overlay): `{ story }` currently shown + a `show` boolean. On tap: set the story, drop `show`, reflow, re-add `show` on `requestAnimationFrame`.
- No new fetching — render from the already-loaded `story` object. The reading page reads `corrected_text || transcribed_text`.

## Design Tokens
```
Mascot / brand purple   --read        #a98ce6
                        --read-deep   #8a6bd4
Lilac surface           --lilac       #e7ddf6
Ink / text              --ink         #241f3a   ink-soft #8d83ad
Paper (book pages)      --paper       #fff8ef   gutter rgba(120,90,60,.x)
Story green (title)     #2f9e6b   byline #6dbf94   body #1a3d2b
StoryCover title ink    #1A2E0A   byline rgba(26,46,10,.5)
Gem chip                #FFD93D on #1A1A2E
In-progress ribbon      #FF6B35 on #fff
Radius   cover 6/12px · page 5/13px · chips 6–7px
Easing   cubic-bezier(.4,.05,.2,1)   Open 1.05s · page turn 2.6s loop
Fonts    Baloo 2 (headings/cover) · Fredoka (UI) · Fredoka One (story title) · Lexend (story body)
```

## Assets
None. All art is CSS/SVG. The soft **gradient panels** in the prototype's cover image slots are **placeholders for the child's uploaded `cover_url` photo** — wire the real image in. The mascot is the same `TutoMascot` already in `src/components/TutoMascot.jsx`.

## Files
- `Book Opening Animation.html` — the interactive prototype (both pieces).
- Reference (existing): `src/components/StoryCover.jsx`, `src/screens/LibraryScreen.jsx`, `src/screens/StoriesScreen.jsx` (`'evaluating'` step), `Stories Reading Animation.html`.
