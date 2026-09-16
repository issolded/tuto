// A FontFaceSet faithful enough for src/lib/fontGate.js, so node-side checks can exercise the
// pictorial question types at all.
//
// The gate deliberately withholds those questions until the pinned font has loaded, and under
// node nothing ever loads — so without this, every audit would quietly measure only the
// geometric third of the engine while reporting a clean run over the whole thing. That is not
// hypothetical: an earlier stub implemented document.fonts.check(), which the gate stopped
// calling when it was tightened, and the audits silently went 100% geometric for a while.
//
// It mirrors what the gate actually reads: iterable faces carrying `family` and `status`, and
// a load() on the FACE rather than on the set.
export function installStubFonts() {
  const faces = ['Material Symbols Outlined'].map(family => ({
    family,
    status: 'loaded',
    load() { this.status = 'loaded'; return Promise.resolve(this) },
  }))
  globalThis.document = {
    fonts: {
      forEach: (cb) => faces.forEach(cb),
      load: () => Promise.resolve(faces),
      check: () => true,
      get ready() { return Promise.resolve() },
    },
  }
  return faces
}
