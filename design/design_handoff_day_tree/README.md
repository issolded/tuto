# Handoff: My Tree — day-tree model + month forest + forest archive (Ages 6–11)

## What this is
An **update** to the My Tree contribution feature, replacing the original *one-tree-per-month* growth with a **one-tree-per-day** model plus a **month forest** and a **fox-guided forest archive**. This handoff covers the **6–11 age bands only** (6–8 primary, 9–11 intermediate share this model). **12–15 ("My Part") is intentionally NOT covered here** — it gets a separate, more mature treatment later. Do not apply this tree/forest/fox UI to the 12–15 shell.

Reference prototype: open **`Day Tree.html`**. It renders the 6–11 "My Tree" screen with live interactions (tap cards → tree grows past full; tap forest trees → date+leaf tooltip; tap fox → forest archive).

## Why we changed it (the problem this solves)
The old model = 1 tree fills over a whole month. A child doing 8–10 tasks/day maxed the tree in ~2 days, then **nothing visibly changed** for the rest of the month — growth feedback died exactly when motivation mattered. The day-tree model gives a fresh, completable goal every day, never lets extra effort go invisible, and turns the long arc into a forest that only ever grows.

## The three mechanics (this is the core of the handoff)

### 1. One tree per day (sprout → full → ornaments)
Each calendar day grows **its own tree**, driven by **approved contributions that day** (`count`):
- **Sprout** (`count` 0–1): a literal shoot from the soil (`_Sprout`), no trunk/canopy.
- **Growing** (`count` 2 → `DAY_FULL`): the tree appears and **eases up in size**, continuously. `scale = 0.34 + 0.66 * clamp(leaves/DAY_FULL)`, anchored at the soil. CSS transition `transform .7s cubic-bezier(.22,1,.36,1)`.
- **Full tree** at **`DAY_FULL = 4`** contributions.
- **Past full → ornaments (no size ceiling):** every extra contribution beyond 4 pops in **one discrete object** — first **fruit** (×5), then **blossom** (×5), then **butterfly** (×2). This is the key fix: the **8th task of the day still makes a visible change**. Pop animation `orn-pop` (scale 0 → 1.25 → 1); butterflies idle-float (`orn-fly`).
- `DAY_FULL = 4` is the current tuning. **Open question for the team:** for very active kids, 5–6 may feel more "earned" — easy to change in one constant.

`TreeArt` props: `fruits` (leaves on the tree, capped at `DAY_FULL` for sizing), `target` (= `DAY_FULL`), `extras` (count beyond full → ornament count), `bloom` (end-of-month shorthand), `size`.

### 2. This month's forest (a strip under the tree)
A horizontal strip of small day-trees — **each finished day is planted here and never disappears.** Today's tree sits at the end, larger, labelled "today", and grows live as the child logs. **Tapping any tree** shows a small popover with that day's **date + leaf count** ("Thu, Jun 18 · 🍃 4 leaves"); the tapped tree gets a green outline. This makes the long-term progress = the forest filling across the month, and reassures that a fresh morning sprout is a new start, not a loss.

### 3. The fox & the forest archive (`forest-archive.jsx`)
The child's avatar fox (top-right) is the **keeper/entrance** to past forests — tap it to slide up the **"My Forests"** archive:
- **Header:** "The fox keeps a track of the forest you've grown 🦊" + a big **all-time tree total** ("637 trees grown, all time 🌳" = current-year YTD + every prior year).
- **Current year (YTD):** each month is a card showing its tree count; tapping a month expands its **mini forest** (row of that month's day-trees), and the **fox rests in the open month**. The current month is flagged **GROWING NOW** with a green border.
- **Earlier years:** summary rows — "2025 · You grew 287 trees", "2024 · …" — tappable to drill into that year.
- Close via the ✕ (returns to today). Slide transition `transform .46s cubic-bezier(.3,.9,.3,1)`.

## Persistent reminder (the feature is abstract)
Because "your tree" needs explaining on return visits, the header carries a permanent one-liner **"Helping grows your tree 🌱"** + a small **"?"** that opens an in-screen popover: *"Every kind thing you do grows a leaf. Fill today's tree, then watch your forest grow all month 🌳"* with a "Got it!" dismiss. (First-time users still get the full intro screen from the original My Tree handoff.)

## What stays the same as the original My Tree handoff
These are unchanged — see `design_handoff_my_tree/README.md` for full detail, don't re-derive:
- **Suggestion cards** (4 categories) are the primary add method; **free-text** is the always-available secondary. 6–8 = illustrated 2-col cards, free-text small; 9–11 = text-forward rows, streak + progress more present.
- **Entry states:** `pending` ("Waiting for approval") vs `approved` ("Approved"), pushed from the parent app (Tuto Care).
- **Add micro-moment:** warm toast, **no points/rewards language**. New copy when past full: *"Your tree is full — here's a little extra! 🦋"*; otherwise *"Nice! I'll check this with your parent 🌱"*.
- The cream agenda "today" page, the design tokens, and the mascot.

## ⚠️ Design vs. backend (don't build a fake data layer)
- **Category** behind each card = data; only *hinted* by icon tint + colour dot, **never labelled to the child.**
- **Free-text moderation** = backend.
- **Approval**, **day/month rollover**, **forest archive history**, **all-time totals**, **streaks** = server-derived. The mocks fake all of these with local state and hard-coded arrays (`PAST`, `THIS_YEAR`, `PAST_YEARS`, `YTD_TREES`, `ALLTIME_TREES`). Wire to real data; keep the UI/animation behavior.

## Day-rollover behavior to confirm with the team
At local midnight: today's finished tree is committed into the month forest, a new **sprout** starts for the new day. Yesterday's tree never shrinks or disappears. Month boundary → the month's forest is sealed into the archive and the strip resets to the new month. (These transitions are implied by the model but not animated in the mock — flag for product sign-off.)

## Files
- `Day Tree.html` — entry point; loads the four jsx files and renders `DayTreeConcept`. (The phone bezel + the explanatory page text around it are **presentation chrome** — the app already has its shell.)
- `day-tree.jsx` — the 6–11 My Tree screen: header + reminder/“?”, the day tree + stage label, the month-forest strip with tap tooltips, the cream diary page with cards, the add/toast logic, and the fox→archive entry. `DAY_FULL`, `DT_CATS`, `PAST` live here.
- `tree-art.jsx` — `TreeArt` (sprout→full→ornaments growth) + `Sprig` (only used by 12–15; ignore for this scope). Port the SVGs to the codebase.
- `forest-archive.jsx` — the "My Forests" archive overlay (`ForestArchive`), its month/year data and the all-time total.
- `tuto-mascot.jsx` — preview copy of the existing mascot; use the app's real one.

## Design tokens (unchanged from My Tree)
Feature green `--green #4cb685` / `--green-deep #37a06f` / `--green-bg #DCF2E7`. Foliage `--leaf #6BBF59` / `--leaf-deep #4FA84A` / `--bark #A9744F`. Ornaments: fruit `#e0524d`, blossom `#f7b6d0`+`#ffd23f` centre, butterfly `#f59ec0`/`#ffc24d`. Category accents (tint/dot only): self `#5aa9e6`, household `#e89a39`, family `#ef7d9d`, outside `#54b487`. Type: Fredoka (UI/headings), Nunito (body), Cormorant Garamond italic (agenda dates). Tree outline ink `#20201e` (matches mascot). Mobile-first PWA, portrait. Respect `prefers-reduced-motion` (idle butterfly float + mascot bob should pause).
