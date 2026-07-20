# Handoff: “My Homework” module

## Overview
A new child-side feature: the kid taps a **My Homework** tile on the home screen, photographs their finished homework (one or more pages), and submits it. Tuto reviews the photos in the background and forwards them to the parent. The gem/XP reward stays **pending until the parent approves** — nothing is awarded on submit.

This bundle covers the **child side only** (home entry → photo upload → “sent for approval” confirmation). The parent-side approval UI is out of scope for this handoff.

## ⚠️ Scope guardrail — read first
**We are ONLY adding the new “My Homework” module.** Do **not** touch, restyle, refactor, or “improve” any existing module (My Books, My Math, My Stories, My Tree, gems, nav, mascot, etc.).

The home tiles, subject icons and mascots drawn in the HTML prototype are **approximations recreated for context** — they do **not** match production pixel-for-pixel and must not be used to “correct” the real components. Wire the new My Homework entry into the existing screens using the **real production components as they already are**.

## About the design files
`My Homework Flow.html` is a **design reference built in HTML** — a prototype showing intended look and behavior, not production code to paste in. The task is to **recreate this flow inside the existing Tuto codebase** (React + Vite + react-router, REST API on Railway, Supabase realtime) using its established patterns. It is clickable: tap the My Homework tile on any phone, add a couple of photos, hit send.

## Fidelity
**High-fidelity** for the new My Homework screens (final colors, type, spacing, copy, interactions — recreate precisely, matching the existing 6–8 visual system). The surrounding home screen shown in the prototype is **context only** (see guardrail above).

## Target codebase — integration points
Prod today ships the **6–8 “chunky-cute” skin**. That is the primary target.

- **`src/screens/ChildHome.jsx`** — add a My Homework entry. Home tiles come from `BASE_TASKS` (each `{ bg, name, route, type }`, rendered in a 2-col grid with `TaskIcon`). Because the grid is 2×2 today, add My Homework as a **5th tile spanning the full width** below the grid (see prototype 6–8), OR extend `BASE_TASKS` — but note the reward pill on other tiles is fixed and dynamic per `task_settings`; **My Homework must NOT show a fixed reward number** (it’s pending/parent-set).
- **`src/App.jsx`** — add a route `<Route path="/child/homework" element={<HomeworkScreen />} />` alongside the other `/child/*` routes.
- **New file `src/screens/HomeworkScreen.jsx`** — holds the upload + sent states (see “Screens” below). Follow the layout conventions in `MyTree.jsx` / `StoriesScreen.jsx` (`Screen`/`BackBtn`, `maxWidth:430`, back → `/child/home`).
- **Photo upload** — model it on `uploadStoryCover(childId, file)` in `src/lib/supabase.js` (base64 → `POST ${SERVER}/api/children/:id/...`). A new server endpoint (e.g. `POST /api/children/:id/homework`) will be needed to store the submission as **pending**; coordinate backend separately.
- **Reward on approval** — gems already update live via the `bt_ledger` INSERT realtime subscription in `ChildHome.jsx`. The homework reward should be a `bt_ledger` insert triggered **only when the parent approves** — the child balance then updates automatically. Do not award on submit.
- **Navigation entry** — the home tile’s `onClick` should `nav('/child/homework')`.

## Screens / Views

### 1. Home tile (entry) — in existing ChildHome
- **Purpose:** launch point for homework submission.
- **Layout:** a full-width card below the existing 2×2 task grid. Left: 82×82 rounded (16px) tinted icon well `#FFF1CF`; right: title `My Homework`.
- **Component detail:** white card, border-radius 22, padding `12px`, shadow `0 6px 16px rgba(40,30,70,.09)`; hover `translateY(-3px)`, active `scale(.97)`. Title Fredoka 600, 18px, `#20201e`.
- **No “NEW” badge, no description subtext, no reward number** (matches the other tiles’ simplicity; reward is dynamic).
- **Icon:** worksheet sheet + camera badge (see Assets).

### 2. Upload
- **Purpose:** child adds photos of finished homework and submits.
- **Layout (6–8):** screen bg `#d4e4fb`. Top bar: circular white back button (42px), centered title `My Homework`. Prompt row: white pill (radius 20, shadow `0 6px 16px rgba(40,30,70,.10)`) with a 42px orange (`#f79433`) circle holding a **camera icon** and text “Take a photo of your finished homework!” (Fredoka 500, 16). Below: a 2-col photo grid — square thumbnails + a dashed “Add photo” tile (3px dashed `#c4bdd0`, radius 20, camera glyph + label). A helper line under the grid (“Add at least one photo” → “N photos ready ✓”).
- **Footer:** full-width primary button “Send to Tuto” — orange, radius 20, Fredoka 600 20px, shadow `0 8px 18px rgba(239,133,31,.45)`. **Disabled** (grey `#d7cfe6`) until ≥1 photo.
- **Multi-photo:** up to 4; each thumbnail has a circular dark “×” remove button (top-right, 26px). Adding animates in (`pop` 0.32s). When 4 reached, hide the add tile; restore it when one is removed.
- **9–11 & 12–15 variants:** same flow, restyled — see prototype. 9–11 uses 2.5–3px ink borders + hard `0 6px 0` shadows, gems as diamonds, copy “Add page” / “Submit to Tuto”, helper “N pages added”. 12–15 uses neutral + single accent `#5860d8`, thin 1.5px borders, radius 13–14, copy “Add page” / “Submit for review”.

#### Submission history — “Last 7 days” (on the Upload screen, below the photo grid)
- **Purpose:** the upload screen is also the child’s homework tracker — under the add-photo area it lists **recent submissions, one per line, each with a status**. This turns a one-shot action into an ongoing status view.
- **Row content:** a single **document icon** (same icon on every row), a **date** (e.g. `16 Jul` — NOT a subject name), a small subtext line (page/photo count, optionally `⭐ +N` on the 9–11 skin), and a **status pill** on the right.
- **Statuses (three):** `chk` = Tuto is checking (blue), `wait` = waiting for parent / pending (amber), `ok` = approved / done (green). Copy per skin: 6–8 `👀 Checking / ⏳ Waiting / ✅ Done`; 9–11 `Tuto checking / With parent / Approved`; 12–15 `In review / Pending / Approved`.
- **Live behavior:** on submit, a new row for the just-sent homework is **prepended** with the `chk` (checking) status. In the real build this list comes from the homework submissions API (last 7 days), newest first; status reflects the server (`checking → pending → approved`, plus rejected if applicable).
- **Styling:** matches each skin’s row vocabulary — 6–8 soft white pills (radius 18, soft shadow); 9–11 chunky ink-bordered cards with `0 5px 0` shadow; 12–15 flat `1.5px #e7e9ef` bordered rows. Section heading: 6–8 “📅 This week”, 9–11 “Last 7 days”, 12–15 uppercase label “LAST 7 DAYS”.

### 3. Sent (pending approval)
- **Purpose:** confirm submission and set expectation that the reward is pending parent approval.
- **6–8:** screen bg `#d4eed9`. Centered celebrating mascot, “Great job! 🎉”, body “I sent your homework to your grown-up to check.”, and a white pending pill “Waiting for ✔ · then ⭐” (no number). Footer button “Done” → resets and returns to `/child/home`.
- **9–11:** lilac gradient card, sidekick mascot, “Homework sent! ⚡”, then a 3-step status list: **done** (green ✓) “Tuto checked your pages” → **wait** (yellow ⏳) “Sent to your parent to approve” → **lock** (🔒) “Reward unlocks on approval”. Footer “Back to home”.
- **12–15:** flat check badge, “Submitted for review”, lead paragraph, and a status card with three rows: Reviewed by Tuto = **Done** (green), Sent to parent = **Pending** (amber), Reward = **Locked** (grey). Footer “Done”.

## Interactions & Behavior
- Tile → navigate to upload screen.
- Add-photo tile → append a thumbnail (real build: open camera / file input, `accept="image/*" capture`). Prototype uses striped placeholders.
- Remove (×) on a thumbnail → delete it; re-enable the add tile if it was hidden at the 4-photo cap; recompute the helper count and the submit button’s disabled state.
- Submit button disabled while photo count is 0.
- Submit → go to Sent screen (real build: upload photos + create pending submission first; show a loading state, then Sent).
- “Done” / “Back to home” → return to home; clear the photo list.
- Transitions: thumbnail entrance `pop` cubic-bezier(.3,1.4,.5,1) 0.32s; cards hover/active transforms as noted.

## State Management
- `photos: File[]` (or upload refs) — the added homework pages.
- `submissions: {id,date,pages,status}[]` — recent submissions (last 7 days) powering the history list; `status ∈ 'checking' | 'pending' | 'approved' | 'rejected'`. Fetch newest-first; on submit optimistically prepend a `checking` row.
- `screen: 'upload' | 'sent'` (or route-based) — the two homework views.
- `submitting: boolean` — loading state during upload.
- On submit success the server stores a **pending** homework submission; no local gem change.
- Gem balance is already owned by `ChildHome` via `getChildGems` + `bt_ledger` realtime — no new client gem state.

## Design Tokens
Colors:
- Ink `#20201e`, ink-soft `#8d83ad` / `#6f6a64`
- Accent orange `#f79433`, deep `#ef851f`
- 6–8 screen bgs: home lilac `#e7ddf6`, upload sky `#d4e4fb`, sent mint `#d4eed9`
- Homework icon well `#FFF1CF`; photo thumb tints `#eadff9 #dcecfb #dbf1e2 #fdeede`
- Character palette: purple `#a98ce6`, green `#79cf86`, blue `#74acef`, yellow `#f5d35f`, pink `#f08bb0`
- 12–15 accent `#5860d8`, accent-soft `#edeefb`, positive `#2f9e63`, line `#e7e9ef`, ink `#1b1f2a`, soft `#737888`

Typography:
- 6–8 & 9–11: `Fredoka` (display, 500/600) + `Nunito` (body, 700/800)
- 12–15: `Space Grotesk` (600) + `Manrope` (600/700/800)

Radii: cards 22 (6–8) / 22 w/ 3px border (9–11) / 14–16 (12–15); pills 999; buttons 20 / 16 / 13.
Shadows: soft `0 6px 16px rgba(40,30,70,.09)` (6–8); hard offset `0 6px 0 rgba(32,32,30,.08)` (9–11); flat `1.5px solid #e7e9ef` borders (12–15).

## Assets
- **Homework tile icon** — worksheet sheet with a camera badge in the corner. Inline SVG in the prototype (`hwIcon()` in the `<script>`). Recreate as an SVG component in the same style as the existing `TaskIcon` set.
- **Camera icon** (upload prompt + add tile) — inline SVG (rounded rect + lens circle + top notch).
- **Mascots** — the prototype redraws Tuto inline; in prod use the real `TutoMascot` component (`src/components/TutoMascot.jsx`) — do not copy the prototype’s mascot SVG.
- No raster assets. Homework photos are user camera captures at runtime; the prototype shows striped placeholders.

## Files
- `My Homework Flow.html` — the clickable design reference (all three age skins: 6–8, 9–11, 12–15; each with home → upload → sent).

### Codebase files to touch (target repo)
- `src/screens/ChildHome.jsx` — add the My Homework tile (entry only).
- `src/App.jsx` — add the `/child/homework` route.
- `src/screens/HomeworkScreen.jsx` — **new** — upload + sent flow.
- `src/lib/supabase.js` — add a homework upload/submit helper (model on `uploadStoryCover`).
- Do **not** modify other screens/components.
