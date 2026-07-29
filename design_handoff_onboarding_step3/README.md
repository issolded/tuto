# Handoff: Onboarding Step 3 — "Where will {child} grow?" (activity picker)

## Overview
Redesign of **Step 3** of the parent onboarding flow (`src/screens/ParentOnboarding.jsx`, the `step === 3` block). This is the screen where a parent chooses which activities their child will do to earn Gems. The old version was a vertical list of full-color rows; the new version is a **tile/card grid that matches the child-facing home screen** (`src/screens/ChildHome.jsx`), plus warmer copy and a short parent-facing benefit line under each activity.

## About the Design Files
`Onboarding Step 3 Redesign.html` in this bundle is a **design reference created in HTML** — a prototype showing the intended look and behavior, not production code to copy verbatim. The task is to **recreate it inside the existing React app** (`ParentOnboarding.jsx`), reusing the app's established patterns: the `PC` design tokens and `Icon`/`Btn` primitives from `src/lib/parentUI.jsx`, and the chunky activity-icon SVGs already defined in `src/screens/ChildHome.jsx`.

## Fidelity
**High-fidelity.** Colors, typography, spacing, copy, and interactions are final. Recreate pixel-for-pixel using the codebase's primitives.

## What changed vs. the current Step 3
1. **Header copy:** `What will {childName} work on? 🌟` → **`Where will {childName} grow? 🌱`**
   (Reason: "work on" framed the child like a worker; "love to do" was rejected because the child may not love it yet — the product's promise is to *build the habit*. "grow" ties to the app's existing tree/leaf metaphor.)
2. **Subtitle:** unchanged — `Choose the activities that earn Gems. You can change these anytime.` (The prototype shows "Pick the activities that earn Gems…" — either is fine; keep the current wording.)
3. **Layout:** the vertical full-color list becomes a **2-column tile grid** matching `ChildHome`.
4. **Color usage:** color now tints only the **icon block** inside each white card (not the whole card). Palette taken directly from `ChildHome`'s `BASE_TASKS` backgrounds.
5. **Icons:** use the **chunky filled SVGs from `ChildHome.jsx`** (`TaskIcon` there), NOT the thin line icons from `parentUI`'s `TaskIcon`.
6. **New: parent-facing benefit line** under each child-facing title (titles stay child-voiced: "My Books" etc.).
7. **My Tree** stays as a full-width dashed info tile (not selectable), as today.

## Screen: Step 3 — Activity picker

### Layout
- Container: existing onboarding column, `maxWidth: 430`, `padding: 18px 24px 48px` (unchanged).
- ProgressBar (STEP 3 OF 10, 30%) and back button: unchanged.
- Header block: `<h1>` + subtitle (see copy above).
- **Grid:** `display:grid; grid-template-columns:1fr 1fr; gap:13px; margin-top:22px`.
  - Cells 1–4 (Books, Math, Stories, Homework): normal tiles, one per column.
  - Cell 5 (Drawings): **full width** — `grid-column:1 / -1`.
  - My Tree: **full width** dashed info tile below the grid.
- Primary `<Btn>` "Next →" below (unchanged behavior; disabled when no task selected).

### Selectable tile (button)
- Card: `background:#fff; border:2px solid <line>; border-radius:22px; padding:14px 14px 15px; display:flex; flex-direction:column; gap:9px; box-shadow:0 6px 16px -10px rgba(40,55,75,.14)`.
- Hover `translateY(-3px)`, active `scale(.97)` (reuse `.tc-press` semantics).
- **Selected** (`tasks[key] === true`): card `border-color` = that task's `tint`; the icon block is full-color; the check badge is filled teal with a white check.
- **Unselected:** icon block `filter:saturate(.55); opacity:.72`; check badge is a white box with a `<line>` border and no check mark.
- **Icon block:** `height:78px; border-radius:16px; background:<tintBg>; flex-centered`; contains the ChildHome chunky SVG for that type, stroked/filled in `<tint>`.
- **Check badge:** absolutely positioned `top:9px right:9px`, `24×24`, `border-radius:8px`. Selected: `background:<teal>` + white check (`Icon name="check" size=13 sw=3 color="#fff"`). Unselected: `background:#fff; border:2px solid <line>`, empty.
- **Title** (`.name`): `font-size:17px; font-weight:800; color:<ink>`. Keep child-facing labels: My Books / My Math / My Stories / My Homework / My Drawings.
- **Benefit line** (`.desc`, NEW): `font-size:12.5px; font-weight:600; color:<inkSoft>; line-height:1.4; margin-top:-2px`. Copy (note trailing periods):
  - My Books → `Builds a daily reading habit.`
  - My Math → `Keeps number skills sharp.`
  - My Stories → `Grows writing & imagination.`
  - My Homework → `Makes homework a routine.`
  - My Drawings → `Encourages creativity every day.`
- **Gem pill** (`.pill`): `align-self:flex-start; background:<tintBg>; color:<tint>; border-radius:11px; padding:4px 10px; font-size:12px; font-weight:800; white-space:nowrap`. Content: `💎 ` + `gemHint(key)` from `src/lib/taskDefaults.js` (e.g. "Up to 30 gems", "25 gems", "20 gems (up to 2/day)"). The prototype renders the drawing hint as "20 gems · up to 2/day"; prefer the canonical `gemHint('drawing')` = "20 gems (up to 2/day)".

**All text uses `FONT` (Plus Jakarta Sans) — the same family as the My Tree subtitle. Do not introduce a second font; the benefit line and the tree description must render in the identical family/weight scale.**

### Per-task tokens (tint = icon/border accent, tintBg = icon-block background)
Backgrounds match `ChildHome` exactly; tints are slightly deepened for legible pills/icons on those pastels.

| key      | title        | tint (accent) | tintBg (block) |
|----------|--------------|---------------|----------------|
| reading  | My Books     | `#8f74d6`     | `#E8E0FF`      |
| math     | My Math      | `#4f97dd`     | `#D4EDFF`      |
| writing  | My Stories   | `#46ac7d`     | `#D4F5E0`      |
| homework | My Homework  | `#e0952f`     | `#FFF1CF`      |
| drawing  | My Drawings  | `#c96aa8`     | `#EFE3FF`      |

Selected check badge fill = `PC.teal` (`#3FB7AC`). Card border (default/unselected) = `PC.line` (`#ECEEF1`). Ink = `PC.ink` (`#21262E`), inkSoft = `#79808C`.

### My Tree info tile (unchanged intent, restyled to match)
- Full-width, `background:#fff; border:1.5px dashed <line>; border-radius:22px; padding:16px 18px; display:flex; align-items:center; gap:15px`.
- Left: `56×56` rounded-16 block, `background:#E6F5EC`, containing the ChildHome tree SVG (leaves in `#4fb283`).
- Right: title `My Tree 🌳` (17px/800), description `Every kind thing they do grows a leaf — no gems, so kindness stays its own reward.` (12.5px/600 inkSoft), then a small `Always on` chip (`#3a9d72` on `#E6F5EC`, radius 8, 11px/800).
- Not a button — no toggle, no check badge.

## Interactions & Behavior
- Tapping a selectable tile toggles `tasks[key]` (existing state — `const [tasks, setTasks] = useState({ reading:true, math:true, writing:true, homework:true, drawing:true })`). Toggle flips the card's selected styling as described.
- "Next →" calls `next()`; keep the existing `disabled={!Object.values(tasks).some(Boolean)}`.
- Transitions: border-color/background/opacity `.18s ease`; transform `.12s ease` (reuse `.tc-press`).

## State Management
No new state. Reuses existing `tasks` object and `next()` from `ParentOnboarding.jsx`. `gemHint` and `TASK_DEFAULTS` already imported from `src/lib/taskDefaults.js`.

## Design Tokens
- Fonts: `FONT` = Plus Jakarta Sans (weights 600/800 used here).
- Radii: card 22, icon block 16, check badge 8, pill 11.
- Card shadow: `0 6px 16px -10px rgba(40,55,75,.14)`.
- Colors: per-task table above + `PC` tokens (`teal #3FB7AC`, `line #ECEEF1`, `ink #21262E`, `inkSoft #79808C`, tree block `#E6F5EC`, tree accent `#4fb283`).
- Grid gap 13, grid margin-top 22, tile gap 9.

## Assets
No image assets. All icons are inline SVG — reuse the `TaskIcon` chunky SVGs already in `src/screens/ChildHome.jsx` (book / calc / pencil / homework camera / tree). For "My Drawings" the prototype uses a pencil-with-dots variant; a plain pencil (same as Stories) is acceptable, or add a small palette-dots variant if desired.

## Files
- `Onboarding Step 3 Redesign.html` — the standalone hi-fi prototype (open in a browser to see final look + toggle behavior).
- Target for implementation: `src/screens/ParentOnboarding.jsx`, the `{step === 3 && (…)}` block.
- Reference for tile styling + icons: `src/screens/ChildHome.jsx`.
- Tokens/primitives: `src/lib/parentUI.jsx` (`PC`, `Icon`, `Btn`); gem copy: `src/lib/taskDefaults.js` (`gemHint`).
