// The web's puzzle drawings, bundled for the Android app (built by build.mjs into
// assets/engine/puzzle.js and loaded into the same QuickJS runtime as the maths engine).
//
// The server writes every puzzle and checks every answer; the tablet only draws what it is sent,
// with the very functions PuzzleView uses. Icon figures need the web icon font, so the app asks
// the server for a sheet without them (icons: false), exactly as the web does when that font
// fails to load.
import { renderFigure } from '../../src/lib/puzzleFigures.js'
import { renderGlyph } from '../../src/lib/puzzleGlyphs.js'

function svg(spec, px) {
  if (!spec) return null
  if (spec.kind === 'icon') return null
  return spec.kind === 'glyph' ? renderGlyph(spec, { px }) : renderFigure(spec, { px, bg: '#FFFFFF' })
}

globalThis.TutoPuzzle = {
  // specs: JSON array of figure specs -> JSON array of SVG strings (null where not drawable).
  draw: (json, px) => JSON.stringify(JSON.parse(json).map(s => { try { return svg(s, px || 96) } catch (e) { return null } })),
}
