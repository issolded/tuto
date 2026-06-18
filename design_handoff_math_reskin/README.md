# Handoff: My Math screen — re-skin to the "6–8" visual system

## Overview
The app already has a fully working **`src/screens/MathScreen.jsx`** — all logic is done (level loading from `math_progress`, `generateMathQuestions`, `evaluateMath`, paper vs. screen modes, scoring, level-up, gem ledger, Supabase persistence). **None of that changes.**

This handoff is a **pure visual re-skin**: swap MathScreen's look from the old purple/Baloo-2 system to the chunky-cute **"6–8 skin"** already used by `ChildHome` and the My Books flow. Same screens, same state machine, same behavior — new paint.

## About the Design Files
The files in this bundle are **design references created in HTML/React-for-preview** — they show the intended look, not production code to copy verbatim. `my-math-journey.jsx` lays out all seven states of the flow as static phone frames using mock data. Recreate that *styling* inside the real `MathScreen.jsx`, keeping its existing hooks, handlers, and data flow exactly as they are.

## Fidelity
**High-fidelity.** Colors, type, spacing, and radii below are final — match them.

## The visual system (design tokens)
This is the same system as `ChildHome.jsx`. Only the accent color differs per task — Math = **blue**.

```
Fonts:      Display/UI → 'Fredoka' (weights 400/500/600/700), weight 600 for headings/buttons
            Body       → 'Nunito' (weights 600–900), weight 700 for small helper text
            (Drop 'Baloo 2' entirely.)

Ink:        --ink        #241f3a   (primary text)
            --ink-soft   #8d83ad   (secondary text)
Math accent --math       #5aa9e6   (was #6C63FF)
            --math-deep  #3d8fcf   (pressed/deep)
            --math-bg    #D4EDFF   (pale fills, the home tile bg)
Support:    --green      #4cb685   (on-screen mode, submit key, correct)
            --orange     #f79433   (backspace key, "answer was…" hints)
            --lilac      #e7ddf6   (app shell bg, behind the flow)

Flow bg:    linear-gradient(172deg,#EAF5FF 0%,#D2E9FB 100%)   (welcome/mode/loading/questions/result body)

Radii:      cards 18–26px · buttons 18–20px · pills 11–14px · keys 50% (circular)
Shadows:    cards  0 8px 26px rgba(60,120,200,.13)
            buttons 0 8px 20px rgba(61,143,207,.34)
Mascot:     <TutoMascot color="#5aa9e6" />  (white on the colored result header)
```

Replace every old token in MathScreen.jsx:
- `#6C63FF` / `#2D2560` purple → `--math` / `--ink`
- `#EEF0FF` background → the flow gradient above (or `--lilac` for shell)
- `"'Baloo 2', cursive"` everywhere → `"'Fredoka', sans-serif"` (weight 600, not 800/900)
- `#2EC486` greens → `--green #4cb685`; `#FFD93D`/`#FF6B35` accents → `--orange #f79433`

## Screens / Views — what each step should look like
Keep the existing `step` state machine (`welcome → mode → loading → paper_questions | screen_questions → evaluating → result`). Re-style only.

1. **welcome** — Centered on flow gradient. Mascot (`size 150`, `expression="excited"`, blue) floating; pre-line welcome message in Fredoka 600 / 21px / `--ink`; a level pill (`📊 {LEVEL_DESC}`) in `rgba(90,169,230,.16)` bg / `--math-deep` text; primary "Let's go! →" button in `--math`, radius 20, `0 10px 28px rgba(61,143,207,.42)`. Back chip top-left: 42px, radius 14, white-85%.

2. **mode** — `BackHeader` row (white 42px ← chip + Fredoka 600/22 title). Two stacked cards (radius 26, white, card shadow): ✏️ **On Paper** with a `--math` gem pill "⭐ +30 Gems"; 📱 **On Screen** with a `--green` pill "⭐ +20 Gems". Helper line in Nunito 700/13.5 `--ink-soft`.

3. **loading / evaluating** — Centered mascot (`expression="thinking"`, blue, floating) + "Preparing your puzzles…" / "Checking your work…" in Fredoka 600/20. Three pulsing `--math` dots.

4. **paper_questions** — Solid `--math` header band (radius `0 0 26px 26px`) with white ← chip, "My Math 🔢" Fredoka 600/21 white, sub "Now solve these on paper! ✏️". Body: each question a white card (radius 18) with a `--math` numbered circle + question in Fredoka 600/22. Sticky white footer with full-width "I'm ready, Tuto! 📸" `--math` button.

5. **screen_questions** — Same `--math` header band but holding the progress bar (track `rgba(255,255,255,.32)`, fill white) + "{n} / {total}". Question card: white, radius 22, Fredoka 600/32, centered. Answer display: white card, Fredoka 600/38 in `--math`, letter-spacing 6. **Number keyboard**: circular keys 70px — digits solid `#2c2745` white text, ⌫ `--orange`, ✓ `--green`; each with soft matching shadow; `.96` scale on press.

6. **flash overlay** — Full-bleed overlay (`rgba(76,182,133,.94)` for correct / `rgba(247,148,51,.94)` for wrong), big emoji (⭐ correct / 💪 wrong, ~78px) popping in, message in Fredoka 600/30 white ("Yes! ⭐" / "Almost! The answer was {n} 💪").

7. **result** — `--math` header band (radius `0 0 32px 32px`) with white mascot (`expression="proud"`) + encouragement Fredoka 600/18 white. Body: a white score/gems card split in two (Score % in `--green`/`--orange` by band, Gems in `--orange`); a level-up banner `linear-gradient(135deg,#5aa9e6,#4cb685)` when leveled up; confetti falling (reuse existing logic, recolor to math/green/orange palette); per-question list (white cards, ✅/🔄, wrong rows show "The answer was {n} 💡" in `--orange`). Footer "Done! 🏠" button.

## Interactions & Behavior — UNCHANGED
Do not touch: `startLoading`, `submitScreenAnswer` (1400ms flash timer), `doScreenEval`, `doPaperEval`, `saveResults`, level math (≥80% up, <40% down), the file-input photo capture, all navigation. Keep all transitions/animations (`float`, `pop`, `confettiFall`, progress width) — just re-time/recolor to match the tokens. Press feedback: `transform: scale(.96)`.

## Components to reuse
`TutoMascot` (existing `src/components/TutoMascot.jsx`) — pass `color="#5aa9e6"`, white on colored headers. The design files include a preview copy (`tuto-mascot.jsx`) for reference only.

## Files in this bundle
- `My Math Journey (6-8 skin).html` — open this to see all 7 frames laid out.
- `my-math-journey.jsx` — the re-skinned markup/styles for every step (mock data). Your source of truth for spacing/structure.
- `tuto-mascot.jsx` — preview copy of the mascot (the real one already lives in the codebase).
- Reference precedent already in the repo: `src/screens/ChildHome.jsx` (same 6–8 system) and the My Books flow.

## Target file
`src/screens/MathScreen.jsx` — re-skin in place. Ensure the `Fredoka` + `Nunito` font links are loaded app-wide (they already are for ChildHome).
