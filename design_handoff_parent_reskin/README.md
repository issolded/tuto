# Handoff: Parent app ("Tuto Care") — visual re-skin

## Overview
The Tuto parent app already works end-to-end against Supabase: auth, onboarding, the
dashboard, the per-child detail screen, and task settings. **This handoff changes none
of that behavior.** It is a **pure visual re-skin** that swaps the current playful
purple / orange / `Baloo 2` parent UI for a calmer, grown-up "Tuto Care" system —
light neutral stage, soft white cards, a teal primary with a warm peach secondary, and
`Plus Jakarta Sans` throughout.

Same screens. Same routes. Same data flow, network calls, and state machines. **New paint only.**

## About the design files
The files in this bundle are **design references created in HTML + React-for-preview** —
they show the intended look and motion, not production code to paste in. `parent/*.jsx`
renders every parent screen as static phone frames driven by an in-memory mock store
(`parent/app.jsx`). Your job is to recreate **that styling** inside the real screens in
`tuto-app/src/screens/`, keeping each screen's existing hooks, handlers, Supabase queries
and navigation exactly as they are.

Open **`Parent Journey (Tuto Care).html`** in a browser to click through the whole flow.

## Fidelity
**High-fidelity.** The tokens, type, spacing and radii below are final — match them.

---

## The visual system (design tokens)
All of these live at the top of `parent/ui.jsx` as the `PC` object — copy them verbatim.

```
Font (everything):  'Plus Jakarta Sans', sans-serif   (weights 400/500/600/700/800)
                    Headings/labels → 700–800 · body → 600 · (drop 'Baloo 2' and 'Nunito')

Neutrals
  stage   #E8EBEE   app backdrop behind the phone
  bg      #F4F6F7   screen background
  card    #FFFFFF
  ink     #21262E   primary text
  inkSoft #79808C   secondary text
  inkFaint#A9AFB9   tertiary / hints / placeholders
  line    #ECEEF1   hairlines & 1.5px borders
  field   #F3F5F7   input + inset fills

Brand
  teal     #3FB7AC  PRIMARY (buttons, active, focus, progress)
  tealDeep #2EA298  pressed / primary text on tinted bg
  tealBg   #E4F4F2  pale teal fill
  peach    #F0A368  warm secondary (goal progress, "to review")
  peachDeep#E08B49
  peachBg  #FCEEE1
  amber    #E9A23B  gems  (amberBg #FBF0D9)
  green    #56BD8C  success / approve / "connected"  (greenBg #E6F5EC)
  danger   #E8695C  destructive / reject             (dangerBg #FCEAE8)

Task accents (kept from kids app for continuity)
  reading #a98ce6 (bg #EFE9FB) · math #5aa9e6 (bg #E2F0FB)
  writing #6cc28a (bg #E4F4EA) · chore #f3a35a (bg #FCEEDF)

Radii    cards 22 · buttons 16 · inputs 15 · pills 999 · tiles/icons 12–15 · sheets 30 (top)
Shadow   card      0 14px 34px -16px rgba(40,55,75,.18), 0 3px 10px -4px rgba(40,55,75,.06)
         card-sm   0 6px 18px -8px rgba(40,55,75,.16), 0 1px 4px rgba(40,55,75,.04)
         button    0 10px 22px -8px {color}cc
Press    .tc-press → transform: scale(.97) on :active (transition .12s)
Motion   tcFloat (mascot), tcUp/tcFade (entrances), tcSheet (bottom sheet),
         tcFall (confetti) — all defined in PCSS in parent/ui.jsx
```

### Old → new replacements to make in every parent screen
- `'Baloo 2', cursive` and `Nunito` → **`'Plus Jakarta Sans'`** (use weight 700/800 for the old 800/900 Baloo headings — don't go heavier than 800).
- Purple `#7C5CBF` / `#2D2560` / `#9B8FC0` / `#EDE8FF`/`#E8E0FF`/`#F8F5FF` → `teal` / `ink` / `inkSoft` / `tealBg` / `bg`.
- The orange child-detail theme (`#FF6B35`, `#FFF8F0`, `#FFE8D4`, `#FF3B30`) → neutral `bg`/`card`/`line` with `teal` accents; **reject** uses `danger`, **approve** uses `green`.
- **Remove the heavy colored header bands.** Child Detail and Task Settings currently use a solid colored header (`#FF6B35`, `#7C5CBF`) with white text + a translucent back button. Replace with the light **`TopBar`** pattern from `parent/ui.jsx`: white 42px back chip (1.5px `line` border, `card-sm` shadow) + `ink` title (800/21) + optional `inkSoft` sub. Page background becomes `bg`.

### Reusable primitives (in `parent/ui.jsx` — rebuild these as your shared kit)
`Phone`/`StatusBar` (preview chrome only — **do not** port), `TopBar`, `Btn`
(`primary`/`soft`/`outline`/`ghost`/`danger`, optional `color`), `Card` (`soft` → small
shadow), `Field`, `Toggle`, `Pill`, `Avatar`, `Icon` (thin 2px line set — replaces the
emoji icons), `TaskIcon`, `BottomSheet`, `Segmented`, `BarChart`, `Ring`, `Confetti`,
`PinPad`, `QRBox`. Building `Btn`/`Card`/`Field`/`Icon`/`BottomSheet` once and reusing
them is the fastest path.

> **Icons:** the new kit uses a thin line-icon set (`Icon name=…`) instead of emoji for
> chrome (back, chevron, gear, lock, edit, trash, bell, mail, qr, camera, logout, etc.).
> Emoji are kept only where they're content: task tiles, rewards, gems ⭐/💎, mascot.

---

## Screens / views — file map and what changes
Routes (in `src/App.jsx`) and component files are **unchanged**. Re-skin each in place.

| Design (preview) | Route | Target file |
|---|---|---|
| `Opening` (role select) | `/` | `src/screens/Opening.jsx` |
| `Login` | `/parent/login` | `src/screens/ParentLogin.jsx` |
| `Signup` | `/parent/signup` | `src/screens/ParentSignup.jsx` |
| `Onboarding` (10 steps) | `/parent/onboarding` | `src/screens/ParentOnboarding.jsx` |
| `Dashboard` | `/parent/dashboard` | `src/screens/ParentDashboard.jsx` |
| `ChildDetail` + modals | `/parent/child/:id` | `src/screens/ParentChildDetail.jsx` |
| `TaskSettings` | `/parent/child/:id/settings` | `src/screens/TaskSettings.jsx` |

### 1 · Opening — `parent/auth.jsx` → `Opening.jsx`
Centered on `bg`. Floating `TutoMascot size={150} color={PC.teal}` over a soft radial teal
glow; wordmark "tuto" (800/42, `ink`, letter-spacing −1.4); one-line tagline (`inkSoft`).
Two full-width white role cards (radius 22, `card` shadow): **I'm a parent** (teal `user`
icon tile) → existing parent-login nav; **I'm a kid** (peach `sparkle` icon tile) → existing
kid nav. Each has title (800/17), sub (600/13 `inkSoft`), trailing `chevron`.
**Keep:** the existing kid branch logic — `nav(localStorage.getItem('family_code') ? '/child' : '/setup')` — and parent → `/parent/login`.

### 2 · Login & 3 · Signup — `parent/auth.jsx` → `ParentLogin.jsx` / `ParentSignup.jsx`
`TopBar` with back chip only (no title). Big heading (800/30, e.g. "Welcome back 👋" /
"Create your account 🌱"), `inkSoft` sub. `Field` + `.tc-input` (radius 15, `field` fill,
focus → teal border + white bg). Primary `Btn` "Sign in" / "Create account". "or" divider
with hairlines. Outline `Btn` with the multicolor Google mark ("Continue with Google").
Footer switch link in `tealDeep`. Login also has a `tealDeep` "Forgot password?" link.
**Keep every handler:** `supabase.auth.signInWithPassword`, `signUp` (+ `parents.full_name`
update), `signInWithOAuth({provider:'google', redirectTo …})`, all nav targets, the
`loading`/`error` state and the error message rendering. Wire the new inputs to the existing
`email`/`password`/`name` state. (The preview shows pre-filled values for display only — keep
real empty defaults.)

### 4 · Onboarding (10 steps) — `parent/onboarding.jsx` → `ParentOnboarding.jsx`
This is the biggest screen; the step machine is identical to what's already there, so
**re-skin step-by-step in place.** Match these per-step looks (see preview):
- **Top chrome:** new `ProgressBar` (teal fill on `line` track, "STEP n OF 9", % in `tealDeep`)
  shown for steps 2–9; white back chip (the `TopBar` chip style) for `showBack` steps.
  Note the preview labels total as **9** (QR is step 10, shown only for "separate device") —
  keep the existing `total`/visibility logic, just restyle the bar.
- **1 Welcome / 9 All set:** centered floating mascot (`excited` / `proud`, teal), 800/30
  heading, `Btn` primary. Step 9 rains `Confetti`.
- **2 Child info:** `Field` name input + the `Stepper` (− / big number / +, teal-bg keys).
- **3 Tasks:** four selectable rows — `TaskIcon` tile in `PC[key+'Bg']`, label 800/16, desc,
  and a check box that fills with the task accent when on (border uses `PC[key]`).
- **4 Rewards:** `Card soft` per reward: emoji + label + amber `Pill 💎`, a `.tc-slider`
  (teal fill, 10–1000), and a `💡 hint` line.
- **5 Notifications:** two big radio cards (Telegram `#229ED9` / WhatsApp `#25D366`, tinted
  when active). The expanded panel keeps the real copy-code / phone-entry UI. Below a hairline,
  an "ADDITIONAL" group with `mail`/`bell` `Icon` rows + `Toggle`s. "Skip for now" `ghost` Btn
  when no channel chosen.
- **6 PIN:** restyled `PinPad` (4 dots that scale + fill teal; `field` keys radius 18; back
  `Icon` for delete). Danger pill for the mismatch error.
- **7 Device:** two large option cards (`phone` / `swap` `Icon`), teal tint when picked.
- **8 Roblox:** centered 🎮, info `Card` on `tealBg`, disabled outline "Coming soon" Btn.
- **10 QR:** the design uses a faux `QRBox`; **in the real app keep the working
  `<QRCodeSVG value={…?code=familyCode}>`** and just wrap it in the white rounded card +
  monospace code pill styling.
**Keep everything functional:** all `useState` step vars, `useEffect` family-code
load/generate, `handlePinInput` (incl. the sibling-PIN-collision check + `hashPin`),
`handleFinish` (child insert, rewards insert, `parents` update, `send-welcome` fetch,
`deviceMode` branch to step 10 vs `/parent/dashboard`), `updateReward`/`confirmAddReward`,
the WhatsApp `send-welcome-whatsapp` fetch, `back()` skip logic, `hasRobloxReward`.

### 5 · Dashboard — `parent/dashboard.jsx` → `ParentDashboard.jsx`
On `bg`. Greeting block ("Welcome back 👋" + parent name 800/26) with a white `logout` chip
(→ existing `signOut` + `nav('/')`). A teal **gradient summary card** ("Pending approvals · N
tasks · across M children", `clock` icon). "My children" section with a teal-bg **+ Add** chip
that opens the **`AddChildSheet`** bottom sheet (avatar picks, name, age stepper, 4-digit PIN).
Each `ChildRow` = `Card` with `Avatar`, name/age, amber gem `Pill` + peach "N to review" `Pill`,
trailing chevron → `nav('/parent/child/:id')`. "Set up a device" `Card` with a show/hide `QRBox`.
"Notifications" `Card` with Telegram / WhatsApp `NotifRow`s (connect inline).
**Keep:** the real `useEffect` user + `parents` load (family_code, telegram_chat_id,
whatsapp_phone, notification_channel) and family-code generate; the `children` fetch + the
"0 children → redirect to onboarding" rule; `_childrenCache`; add-child flow (avatar
upload to `submissions` storage, `children` insert, `hashPin`); telegram/whatsapp connect
calls; `signOut`. The summary count must derive from the real submissions/children data the
screen already has — don't fabricate it.

### 6 · Child Detail (+ modals) — `parent/child-detail.jsx` → `ParentChildDetail.jsx`
Light `TopBar` (name + "N years old" + back). Profile `Card`: `Avatar`, amber gems `Pill`.
Sections (all `SectionHead` 800/16.5): **⏳ Pending approvals** → `SubmissionCard`s
(`TaskIcon` tile, label/desc/time, amber "+N ⭐", optional `🤖 AI` tag, `PhotoStub`/photo,
teal note bubble, **green Approve / danger Reject** `Btn`s); **✅ Completed today**; **🏆
Reward goals** (progress bars: peach in-progress, green ready; + Add goal → `AddRewardSheet`);
a settings group of `Card`s (Task settings, Edit child, Change PIN) + a red-outline **Remove
child** button. Approving triggers `Confetti`.
**Modals** become `BottomSheet`s: `EditChildSheet`, `ChangePinSheet` (reuses `PinPad`),
`AddRewardSheet` (emoji grid + name + cost slider), `RemoveSheet`.
**Keep:** the `useEffect` `Promise.all` load (`children`, `bt_ledger` → summed gems,
`submissions`, `rewards`); `pending`/`todayDone` filters & `isToday`; `handleApprove`
(submission update + `bt_ledger` insert + local gem bump), `handleReject`; all modal save
paths (`EditChildModal` avatar upload + `children` update; `ChangePinModal` sibling-collision
+ `hashPin` + `children` update; `AddRewardModal` `rewards` insert; `RemoveConfirmModal`
delete + nav with `removedId`); the back-nav `state: { updatedChild }`.
> **Note — the design adds a weekly bar chart + weekly-goal bar to this screen that the
> current code has no data for.** Treat these as optional: only wire them if real per-day
> gem data is available (e.g. aggregate `bt_ledger` by day), otherwise omit them. **Do not
> invent data to fill the chart** — that would be changing the journey, not the design.

### 7 · Task Settings — `parent/child-detail.jsx` → `TaskSettings.jsx`
Light `TopBar` ("Task settings" + child name + a "Saving…" indicator on the right). Intro
line, then one `Card` per task (`reading`/`math`/`writing`/`chore`): `TaskIcon` tile, label,
"+N gems / session" in the task accent (or "Disabled"), a `Toggle`, and a teal `.tc-slider`
(5–100) shown when active; whole card dims to .6 when off.
**Keep:** the existing `children.task_settings` load, the debounced/`ping` save
(`children.task_settings` update), `DEFAULT_SETTINGS`, and the back nav to `/parent/child/:id`.

---

## Interactions & motion (match, don't add)
- Press feedback everywhere: `.tc-press` → `scale(.97)`.
- Inputs: focus → teal border + white fill (`.tc-input`).
- Bottom sheets slide up (`tcSheet`, ~.3s) over a `rgba(25,32,42,.42)` scrim; drag-handle pill on top.
- Mascot floats (`tcFloat`); step/section entrances use `tcUp`/`tcFade`; confetti uses `tcFall`.
- Sliders: teal thumb (24px, 4px white ring) with a teal→`line` track gradient at the value %.
- Keep every existing timeout/transition (PIN confirm delay, approve confetti ~2.2s, "Saving…" ping ~700ms, copy-confirm) — re-time only if needed to match.

## State management
No new app state. Each screen keeps its current `useState`/`useEffect`/Supabase wiring as
listed above. The preview's `parent/app.jsx` mock store exists only to render the frames —
**do not** port it.

## Assets
- **`TutoMascot`** — reuse the existing `src/components/TutoMascot.jsx`; pass `color={PC.teal}`
  (and `expression="excited"/"proud"`). `parent/tuto-mascot.jsx` is a preview copy only.
- **Icons** — the thin line set lives in `parent/ui.jsx` (`Icon`); port it as a small component.
- **Telegram / WhatsApp marks** — the real screens already load the Wikimedia SVGs; keep those.
- **QR** — keep the real `qrcode.react` `QRCodeSVG`; the preview `QRBox` is decorative.
- Fonts: load `Plus Jakarta Sans` (400–800) app-wide (replaces Baloo 2 / Nunito links).

## Files in this bundle
- `Parent Journey (Tuto Care).html` — open to click through all parent screens.
- `parent/ui.jsx` — **the design system**: `PC` tokens, `PCSS` keyframes, and every primitive. Your source of truth.
- `parent/auth.jsx` — Opening, Login, Signup.
- `parent/onboarding.jsx` — all 10 onboarding steps + `PinPad` + `QRBox`.
- `parent/dashboard.jsx` — Dashboard + Add-child sheet + notification rows.
- `parent/child-detail.jsx` — Child detail, all modals, and Task settings.
- `parent/app.jsx` — preview mock store + router (reference only; do not port).
- `parent/tuto-mascot.jsx` — preview copy of the mascot (real one is in the repo).

## Target codebase
`tuto-app/` (Vite + React + react-router + Supabase). Re-skin the seven screens listed in the
map above, in place. Precedent already in the repo for the same "Tuto Care" direction can be
mirrored for visual consistency, but the parent screens are the scope here.
