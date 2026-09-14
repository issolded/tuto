// Whether a pinned webfont has really been obtained by this page — the gate the puzzle
// module's pictorial questions hang on.
//
// Three measurements shaped this file, each one correcting the last, and none of them was
// visible from reading the spec.
//
// 1. document.fonts.check() answers the wrong question.
//
//      check("32px 'SomethingNobodyDeclared'")    → true
//      check("32px 'Declared-but-not-yet-loaded'") → false
//
//    It reports "can this text be drawn without waiting on an unloaded face", so a family with
//    no @font-face rule at all passes immediately — nothing is pending, the fallback will do.
//    For every other use that is sensible. For this one it is backwards: a missing stylesheet
//    is exactly when the module MUST withhold its pictorial questions, and check() waves it
//    through. It happened — the lab was opened in a browser where the app crashed before the
//    stylesheet was imported, and both gates reported ready.
//
// 2. Reading the face instead is not enough either, if the device owns a font of the same
//    name. This machine has a system Noto Color Emoji; Chromium satisfied the text from it and
//    left OUR face at "unloaded", while a set-level load() resolved without fetching anything.
//    So the load has to be asked of the FontFace object itself.
//
// 3. And status is a reading of the moment, not a fact. Traced across a real page load, our
//    emoji face went unloaded → loaded at 625ms → unloaded again by 1025ms: the browser had
//    drawn the glyphs from the system copy, decided ours was unused, and evicted it. A gate
//    reading status directly would have opened, then shut again mid-session, and the child's
//    sheet would have quietly lost a third of its question types partway through.
//
// So the gate LATCHES. The question it answers is "has this page successfully fetched the
// pinned font", and an eviction does not un-fetch it — the bytes are in cache and the next
// paint re-uses them. What must still fail closed is the case that started all this: no
// stylesheet, no face, nothing to load, gate shut.

const obtained = new Set()

// OUR @font-face for this family, or null if the stylesheet never loaded. A FontFace we
// declared is unambiguous: it is ours, we can load it, and nothing the device happens to own
// can stand in for it.
function faceFor(family) {
  let hit = null
  // FontFaceSet is iterable, and a FontFace's `family` may or may not keep its quotes
  // depending on how the rule was written, so both spellings are compared bare.
  document.fonts.forEach((face) => {
    if (face.family.replace(/['"]/g, '') === family) hit = face
  })
  return hit
}

export function fontLoaded(family) {
  if (typeof document === 'undefined' || !document.fonts) return false
  if (obtained.has(family)) return true
  try {
    // Before ensureFont has run there is still an honest answer to give: the face exists and
    // the browser already has it. Latched from here on, for the reason in note 3.
    if (faceFor(family)?.status === 'loaded') {
      obtained.add(family)
      return true
    }
    return false
  } catch {
    return false
  }
}

// A font is only fetched when something on the page actually USES it, which sets a deadlock
// against the gate: no pictorial questions are offered because the font is not loaded, and the
// font is never loaded because nothing uses it. The preview page walked straight into it — the
// icon family vanished from every sheet with no error anywhere. So the load is requested
// explicitly, once, before the gate is consulted.
export function ensureFont(family) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve(false)
  if (obtained.has(family)) return Promise.resolve(true)
  const face = faceFor(family)
  if (!face) return Promise.resolve(false)
  // face.load() rather than document.fonts.load(): the set-level call is satisfied by whatever
  // can already draw the text, so where a device owns a font of the same name it resolves
  // without ever fetching ours — note 2.
  const done = face.status === 'loaded' ? Promise.resolve() : face.load()
  return done
    .then(() => {
      obtained.add(family)
      return true
    })
    .catch(() => false)
}

// Testing seam. The latch is deliberately permanent for the life of the page, which makes it
// impossible to exercise the closed path twice in one test run without this.
export function resetFontGate() {
  obtained.clear()
}
