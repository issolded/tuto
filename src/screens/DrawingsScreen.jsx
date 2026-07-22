import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { drawingStepUrl, getDrawings, getPaintings, submitPainting } from '../lib/supabase'

// ── Age skins ────────────────────────────────────────────────────────────────
// Same flow, three presentations (see SKINS in the design prototype). The
// reward LABEL differs per age; the reward AMOUNT is decided by the server and
// is only ever rendered from its response.
const SKINS = {
  young: {
    bg: 'linear-gradient(180deg,#FFF6E8 0%,#FFE9CF 100%)',
    accent: '#f79433', ink: '#20201e', radius: 22,
    gemIcon: '⭐', stepWord: 'step',
    readySay: "Grab some paper and a pencil.\nTap ready when you're set!",
    done: 'Your masterpiece is saved. Your grown-up can see it too!',
  },
  mid: {
    bg: 'linear-gradient(180deg,#F3EEFF 0%,#E4DBFB 100%)',
    accent: '#7c5cd6', ink: '#20201e', radius: 22,
    gemIcon: '◆', stepWord: 'Step',
    readySay: 'Get your paper and pencil ready. Take your time — no rush!',
    done: 'Nice work! Your painting is in your library and you earned gems.',
  },
  mature: {
    bg: 'linear-gradient(180deg,#F7F8FB 0%,#ECEEF5 100%)',
    accent: '#5860d8', ink: '#1b1f2a', radius: 14,
    gemIcon: '✦', stepWord: 'Step',
    readySay: "Grab paper and a pencil. When you're set, start the guided steps.",
    done: 'Saved to your library. Reward added to your balance.',
  },
}

// The child's age band picks the skin AND which sketch set is fetched — the
// 9-11 "cat" is a different set of drawings, not a resize of the 6-8 one.
function bandFor(age) {
  if (age == null) return 'young'
  if (age <= 8) return 'young'
  if (age <= 11) return 'mid'
  return 'mature'
}
const AGE_GROUP = { young: '6-8', mid: '9-11', mature: '12-15' }

// Per-step hints, from TARGETS[].steps[].tip in the prototype.
const STEP_TIPS = {
  cat: [
    'Draw a big oval for the head.',
    'Add an egg shape below for the body.',
    'Two pointy ears on top.',
    'Draw two big round eyes.',
    'Colour the eyes in and add pupils.',
    'A little nose, a smile and paw lines.',
    'Long whiskers and a curvy tail.',
    'Add stripes and fur — your cat is done!',
  ],
  dog: [
    'Draw a big round head.',
    'Add an egg shape below for the body.',
    'Two floppy ears on the sides.',
    'Round eyes, a little nose and a smile.',
    'Colour the eyes in dark.',
    'Draw the front legs and paws.',
    'Add a happy wagging tail!',
    'Add the spots — all done!',
  ],
  bee: [
    'Draw a circle for the head.',
    'Add a big oval body behind it.',
    'Two curly antennae with little balls on top.',
    'Draw two big round eyes.',
    'Add a happy smile.',
    'Two big wings and tiny legs.',
    'Add the stripes and a stinger — buzz, done!',
  ],
  axolotl: [
    'Draw a big round head.',
    'Add a chubby body and little arms.',
    'Two big shiny eyes.',
    'Add a happy open smile.',
    'Feathery gills on both sides and a long tail.',
    'Go over your lines and add shading — done!',
  ],
  caterpillar: [
    'Draw a big circle for the head.',
    'Add a round body part behind it.',
    'Keep adding circles to make the body longer.',
    'Two big eyes and a happy smile.',
    'Add two curly antennae on top.',
    'Little legs under each body part.',
    'Add spots and stripes on the body.',
    'Draw a leaf under your caterpillar — done!',
  ],
  house: [
    'Draw a big square for the walls.',
    'Put a triangle roof on top.',
    'Add a door in the middle.',
    'Two windows, one on each side.',
    'Draw the window panes and a doorknob.',
    'Add a chimney and some smoke.',
    'Draw a path and a little fence.',
    'Add bricks, grass and a sun — all done!',
  ],
  // Seven steps, not eight: the original step 5 went BACKWARDS (the antenna and
  // ears it had just added disappeared again), so it was dropped and the rest
  // renumbered. Step 4 → 5 now only ever adds.
  robot: [
    'Draw a square for the head.',
    'Add a big square body underneath.',
    'Bendy arms, round hands, legs and feet.',
    'An antenna, two big eyes and side ears.',
    'Add a screen and buttons on the tummy.',
    'Bolts on the corners and little fingers.',
    'Add shading and details — beep boop, done!',
  ],
}

const CATEGORIES = ['All', 'Animals', 'Characters', 'Objects', 'Nature']
const LOCKED = [
  { name: 'Butterfly', category: 'Animals' },
  { name: 'Alien', category: 'Characters' },
  { name: 'Rocket', category: 'Objects' },
  { name: 'Sun', category: 'Nature' },
]

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch { return '' }
}

// ── Small pieces ─────────────────────────────────────────────────────────────
function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 42, height: 42, borderRadius: '50%', border: 'none', background: '#fff',
      boxShadow: '0 4px 12px rgba(40,30,70,.12)', cursor: 'pointer', fontSize: 18, color: '#20201e',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>←</button>
  )
}

function Title({ children, sk }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 19, color: sk.ink }}>
      {children}
    </div>
  )
}

// Category tints, from the design prototype. The sketches are transparent PNG
// data, so the tint reads through the whole panel rather than sitting in bars
// beside a white square. The well stays SQUARE to match the 1024x1024 asset.
const CATEGORY_TINT = {
  Animals: '#FFF1CF',
  Characters: '#e7ddf6',
  Objects: '#d4e4fb',
  Nature: '#d4f5e0',
}
const PANEL_BG = '#faf7ff'

function DrawingThumb({ id, ageGroup, stepCount, category, radius = 14 }) {
  // The last panel is the finished drawing — the natural thumbnail.
  return (
    <div style={{
      width: '100%', aspectRatio: '1', borderRadius: radius, overflow: 'hidden',
      background: CATEGORY_TINT[category] || PANEL_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img src={drawingStepUrl(id, ageGroup, stepCount)} alt="" loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </div>
  )
}

// Where a saved drawing stands. The reward is not instant — a grown-up has to
// approve it — so the child needs to see which of theirs are still waiting.
function statusLabel(p, sk) {
  if (p.status === 'approved') {
    return p.reward_amount > 0
      ? { text: `${sk.gemIcon} +${p.reward_amount}`, color: sk.accent }
      : { text: '✓ Approved', color: '#37a06f' }
  }
  if (p.status === 'rejected') return { text: 'Not this time', color: '#9a93a8' }
  return { text: '◷ Waiting', color: '#b9892f' }
}

function PaintingStatus({ p, sk, compact }) {
  const s = statusLabel(p, sk)
  return (
    <div style={{ marginTop: compact ? 4 : 3 }}>
      <div style={{
        fontFamily: 'Nunito, sans-serif', fontWeight: 800,
        fontSize: compact ? 10.5 : 11.5, color: s.color,
      }}>
        {s.text}
      </div>
      <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: compact ? 9.5 : 11, color: '#8d83ad' }}>
        {fmtDate(p.created_at)}
      </div>
    </div>
  )
}

// ── Browse ───────────────────────────────────────────────────────────────────
function Browse({ sk, drawings, ageGroup, paintings, onPick, onFree, onLibrary, onBack, loading }) {
  const [cat, setCat] = useState('All')
  const shown = cat === 'All' ? drawings : drawings.filter(d => d.category === cat)
  const shownLocked = cat === 'All' ? LOCKED : LOCKED.filter(l => l.category === cat)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>My Drawings</Title>
        <div style={{ width: 42 }} />
      </div>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12 }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            flexShrink: 0, padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
            border: cat === c ? 'none' : '1.5px solid rgba(32,32,30,.14)',
            background: cat === c ? sk.accent : '#fff',
            color: cat === c ? '#fff' : '#6f6a64',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
          }}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#8d83ad' }}>
          Loading drawings…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {shown.map(d => (
            <button key={`${d.id}-${d.age_group}`} onClick={() => onPick(d)} style={{
              background: '#fff', border: 'none', borderRadius: sk.radius, padding: 10,
              boxShadow: '0 6px 16px rgba(40,30,70,.09)', cursor: 'pointer', textAlign: 'center',
            }}>
              <DrawingThumb id={d.id} ageGroup={d.age_group} stepCount={d.step_count}
                category={d.category} radius={sk.radius - 8} />
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink, marginTop: 9 }}>{d.name_en}</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: sk.accent, marginTop: 3 }}>
                ✎ {d.step_count} {sk.stepWord}s
              </div>
            </button>
          ))}
          {shownLocked.map(l => (
            <div key={l.name} style={{
              background: 'rgba(255,255,255,.55)', borderRadius: sk.radius, padding: 10,
              opacity: .75, textAlign: 'center',
            }}>
              <div style={{
                width: '100%', aspectRatio: '1', borderRadius: sk.radius - 8, background: '#f0ecf7',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>🔒</div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: '#8d83ad', marginTop: 9 }}>{l.name}</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: '#b3a894', marginTop: 3 }}>SOON</div>
            </div>
          ))}
        </div>
      )}

      {/* free draw — skips the guided steps entirely */}
      <button onClick={onFree} style={{
        width: '100%', marginTop: 14, background: '#fff', border: 'none', borderRadius: sk.radius,
        padding: '14px 16px', boxShadow: '0 6px 16px rgba(40,30,70,.09)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
      }}>
        <span style={{
          width: 40, height: 40, borderRadius: 13, background: sk.accent, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
        }}>✎</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15.5, color: sk.ink }}>
            Draw my own idea
          </span>
          <span style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#8d83ad' }}>
            Skip the steps — draw whatever you want
          </span>
        </span>
        <span style={{ color: sk.accent, fontSize: 17 }}>▸</span>
      </button>

      {/* Recent work, right on the hub — the child shouldn't have to open the
          library to see that what they drew was saved and what it earned. */}
      {paintings.length > 0 && (
        <div style={{
          marginTop: 14, background: '#fff', borderRadius: sk.radius, padding: '13px 14px',
          boxShadow: '0 6px 16px rgba(40,30,70,.09)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink }}>My Paintings</span>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#8d83ad' }}>{paintings.length}</span>
            <button onClick={onLibrary} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12.5, color: sk.accent, padding: 0,
            }}>Open library ▸</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {paintings.slice(0, 3).map(p => (
              <button key={p.id} onClick={onLibrary} style={{
                border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'center',
              }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: sk.radius - 8, display: 'block' }} />
                  : <div style={{ width: '100%', aspectRatio: '1', borderRadius: sk.radius - 8, background: PANEL_BG }} />}
                <PaintingStatus p={p} sk={sk} compact />
              </button>
            ))}
          </div>
        </div>
      )}

      {paintings.length === 0 && (
        <button onClick={onLibrary} style={{
          width: '100%', marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13, color: sk.accent, padding: '8px 0 20px',
        }}>
          Open library ▸
        </button>
      )}
      <div style={{ height: 16 }} />
    </>
  )
}

// ── Ready ────────────────────────────────────────────────────────────────────
function Ready({ sk, target, ageGroup, onStart, onBack }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{target ? target.name_en : 'My own idea'}</Title>
        <div style={{ width: 42 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
        <TutoMascot size={130} />
      </div>

      <div style={{
        background: '#fff', borderRadius: sk.radius, padding: '16px 18px', margin: '14px 0',
        boxShadow: '0 6px 16px rgba(40,30,70,.09)', textAlign: 'center',
        fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16.5, color: sk.ink, whiteSpace: 'pre-line',
      }}>
        {sk.readySay}
      </div>

      {target && (
        <div style={{ maxWidth: 200, margin: '4px auto 10px' }}>
          <DrawingThumb id={target.id} ageGroup={ageGroup} stepCount={target.step_count}
            category={target.category} radius={sk.radius - 8} />
        </div>
      )}

      <button onClick={onStart} style={ctaStyle(sk, false)}>I'm ready!</button>
    </>
  )
}

// Leaving the guided steps mid-drawing loses your place in the panels — the
// top-left arrow is the ONLY way out of this screen (stepping back through
// panels is the footer Back button's job instead), so it always confirms
// first rather than silently dropping progress.
function ExitConfirmModal({ sk, onCancel, onConfirm }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(40,45,35,.42)', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 340, background: '#fff', borderRadius: sk.radius, padding: 22,
        textAlign: 'center', boxShadow: '0 14px 32px rgba(0,0,0,.20)',
        animation: 'ttPop .24s cubic-bezier(.2,.9,.3,1.2) both',
      }}>
        <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 18, color: sk.ink }}>
          Leave this drawing?
        </div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#8d83ad', marginTop: 8, lineHeight: 1.4 }}>
          Your steps so far won't be saved.
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px', borderRadius: sk.radius - 8, border: '1.5px solid rgba(32,32,30,.14)',
            background: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#6f6a64', cursor: 'pointer',
          }}>Keep drawing</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '13px', borderRadius: sk.radius - 8, border: 'none',
            background: sk.accent, color: '#fff', fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}>Leave</button>
        </div>
      </div>
    </div>
  )
}

// ── Guided steps ─────────────────────────────────────────────────────────────
function Steps({ sk, target, ageGroup, step, setStep, onFinish, onBack }) {
  const total = target.step_count
  const tips = STEP_TIPS[target.id] || []
  const isLast = step >= total - 1
  const [confirmExit, setConfirmExit] = useState(false)

  // Panels are cumulative — step N+1 is step N plus a few more pencil lines in
  // the exact same spots, nothing removed. So the two images to cross-fade are
  // never symmetric: one is a strict superset of the other. The image with
  // FEWER lines can't visually cover the one with more (its "empty" area is
  // transparent, not white — stacking it on top just lets the extra ink show
  // through underneath regardless of opacity). So the emptier image always
  // sits on the constant, fully-opaque BOTTOM, and the richer image is the one
  // that animates on TOP — fading IN (new ink appearing) when moving forward,
  // fading OUT (ink un-appearing) when moving back with Back. `baseStep` is
  // the settled step; it only catches up to `step` once the fade finishes, so
  // rapid taps just retarget the fade instead of queuing several.
  const [baseStep, setBaseStep] = useState(step)
  const [revealed, setRevealed] = useState(true)
  const forward = step > baseStep
  const poorerStep = Math.min(baseStep, step)
  const richerStep = Math.max(baseStep, step)

  // Hide the new top layer SYNCHRONOUSLY, before the browser paints — a plain
  // effect runs after commit, so the freshly-mounted <img key={step}> would
  // still carry the PREVIOUS transition's `revealed=true` on its very first
  // paint and just appear fully visible with no fade (confirmed: opacity read
  // back as 1 within a few ms of the click, no partial value ever observed).
  // useLayoutEffect's setState is flushed before paint, so this correction is
  // what the browser actually renders first.
  useLayoutEffect(() => {
    if (step !== baseStep) setRevealed(false)
  }, [step, baseStep])

  // Only once that hidden frame has actually been painted, fade it back in.
  useEffect(() => {
    if (step === baseStep) return
    // A single rAF isn't reliably enough for the browser to have painted the
    // opacity:0 frame from the layout effect above before flipping to 1.
    let raf2
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setRevealed(true)) })
    const settle = setTimeout(() => setBaseStep(step), 420)
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); clearTimeout(settle) }
  }, [step, baseStep])

  // Warm the neighbouring panels. Without this every tap on Next waits on a
  // fresh download and the child watches an empty frame; the panels are only
  // ~20-45 KB, so fetching one ahead is cheap and keeps the flow instant.
  useEffect(() => {
    ;[step + 2, step].forEach(n => {
      if (n >= 1 && n <= total) new Image().src = drawingStepUrl(target.id, ageGroup, n)
    })
  }, [step, target.id, ageGroup, total])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 10px' }}>
        <BackBtn onClick={() => setConfirmExit(true)} />
        <Title sk={sk}>{target.name_en}</Title>
        <div style={{ width: 42 }} />
      </div>

      <div style={{
        textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 800,
        fontSize: 13, color: sk.accent, marginBottom: 8,
      }}>
        {sk.stepWord} {step + 1}/{total}
      </div>

      {/* segment progress bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 999,
            background: i <= step ? sk.accent : 'rgba(32,32,30,.13)',
          }} />
        ))}
      </div>

      {/* Two stacked layers so a step change fades the new ink in over the old,
          instead of hard-cutting to the next panel — see baseStep/revealed above. */}
      <div style={{
        background: CATEGORY_TINT[target.category] || PANEL_BG, borderRadius: sk.radius, padding: 10,
        boxShadow: '0 6px 16px rgba(40,30,70,.09)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '1' }}>
          <img
            src={drawingStepUrl(target.id, ageGroup, poorerStep + 1)}
            alt={`${target.name_en} ${sk.stepWord} ${poorerStep + 1}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: sk.radius - 8 }}
          />
          {step !== baseStep && (
            <img
              key={`${richerStep}-${forward ? 'in' : 'out'}`}
              src={drawingStepUrl(target.id, ageGroup, richerStep + 1)}
              alt={`${target.name_en} ${sk.stepWord} ${richerStep + 1}`}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: sk.radius - 8,
                // Forward: hidden → shown (ink fading in). Back: shown → hidden
                // (ink fading out, since richerStep is where we came FROM).
                opacity: forward ? (revealed ? 1 : 0) : (revealed ? 0 : 1),
                transition: 'opacity 420ms ease',
              }}
            />
          )}
        </div>
      </div>

      {tips[step] && (
        <div style={{
          marginTop: 12, background: '#fff', borderRadius: sk.radius, padding: '13px 16px',
          boxShadow: '0 6px 16px rgba(40,30,70,.09)',
          fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 15.5, color: sk.ink, textAlign: 'center',
        }}>
          {tips[step]}
        </div>
      )}

      {/* Equal-width pair: this is the ONLY way to move between panels now that
          the top arrow is exit-only, so Back needs to be as prominent as Next. */}
      <div style={{ display: 'flex', gap: 9, marginTop: 16, paddingBottom: 20 }}>
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{
          flex: 1, padding: '14px 10px', borderRadius: sk.radius - 4, border: '1.5px solid rgba(32,32,30,.14)',
          background: '#fff', cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? .45 : 1,
          fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14.5, color: '#6f6a64',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><span>←</span> Back</button>
        <button onClick={() => (isLast ? onFinish() : setStep(step + 1))} style={{
          ...ctaStyle(sk, false), flex: 1, marginTop: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          {isLast ? "I drew it!" : <>Next <span>→</span></>}
        </button>
      </div>

      {confirmExit && (
        <ExitConfirmModal sk={sk} onCancel={() => setConfirmExit(false)} onConfirm={onBack} />
      )}
    </>
  )
}

// ── Upload ───────────────────────────────────────────────────────────────────
function Upload({ sk, target, photo, onPick, onClear, onSubmit, submitting, error, onBack }) {
  const fileRef = useRef(null)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{target ? target.name_en : 'My own idea'}</Title>
        <div style={{ width: 42 }} />
      </div>

      <div style={{
        background: '#fff', borderRadius: sk.radius, padding: '14px 16px', marginBottom: 14,
        boxShadow: '0 6px 16px rgba(40,30,70,.09)', display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <span style={{
          width: 42, height: 42, borderRadius: '50%', background: sk.accent, color: '#fff', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>📷</span>
        <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 500, fontSize: 15.5, color: sk.ink }}>
          Take a photo of your finished drawing!
        </span>
      </div>

      {photo ? (
        <div style={{ position: 'relative' }}>
          <img src={photo.url} alt="" style={{ width: '100%', borderRadius: sk.radius, display: 'block' }} />
          <button onClick={onClear} disabled={submitting} style={{
            position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: '50%',
            border: 'none', background: 'rgba(30,30,25,.66)', color: '#fff', fontWeight: 800, fontSize: 15,
            cursor: submitting ? 'default' : 'pointer',
          }}>✕</button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} style={{
          width: '100%', padding: '46px 16px', borderRadius: sk.radius,
          border: '3px dashed #c4bdd0', background: 'rgba(255,255,255,.6)', cursor: 'pointer',
          fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: '#8d83ad',
        }}>📷<br />Add photo</button>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />

      {error && (
        <div style={{
          marginTop: 12, background: '#FFF0EE', color: '#D63030', borderRadius: 12, padding: '10px 14px',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12.5, textAlign: 'center',
        }}>{error}</div>
      )}

      <button onClick={onSubmit} disabled={!photo || submitting} style={ctaStyle(sk, !photo || submitting)}>
        {submitting ? 'Saving…' : 'Add to my library'}
      </button>
    </>
  )
}

// ── Reward ───────────────────────────────────────────────────────────────────
// Renders ONLY what the server said it awarded. There is no client-side amount
// to fall back on, by design.
// Sent, not paid. The drawing waits for a grown-up, so this screen must not
// show a gem total — promising a number here and having the parent reject it
// is exactly the let-down the approval flow is meant to avoid.
function Reward({ sk, result, onLibrary, onAgain }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <TutoMascot size={140} />
      <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 25, color: sk.ink, marginTop: 12 }}>
        Great job! 🎉
      </div>
      <div style={{
        fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#6f6a64',
        margin: '10px 22px 18px', lineHeight: 1.45,
      }}>
        I sent your drawing to your grown-up to look at.
      </div>

      <div style={{
        display: 'inline-block', background: '#fff', borderRadius: 999, padding: '11px 22px',
        boxShadow: '0 6px 16px rgba(40,30,70,.10)',
        fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 17, color: '#b9892f',
      }}>
        ◷ Waiting for ✔ · then {sk.gemIcon}
      </div>

      {result?.painting?.photo && (
        <img src={result.painting.photo} alt="" style={{
          width: '100%', borderRadius: sk.radius, marginTop: 20, display: 'block',
        }} />
      )}

      <button onClick={onLibrary} style={ctaStyle(sk, false)}>See my library</button>
      <button onClick={onAgain} style={{
        width: '100%', marginTop: 9, padding: '13px', borderRadius: sk.radius - 4,
        border: '1.5px solid rgba(32,32,30,.14)', background: '#fff', cursor: 'pointer',
        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#6f6a64',
      }}>Draw again</button>
    </div>
  )
}

// ── Library ──────────────────────────────────────────────────────────────────
function Library({ sk, paintings, drawings, loading, onBack, onAgain }) {
  const nameFor = p => {
    if (!p.drawing_id) return 'My own drawing'
    return drawings.find(d => d.id === p.drawing_id)?.name_en || p.drawing_id
  }
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>My Paintings</Title>
        <div style={{ width: 42 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#8d83ad' }}>
          Loading…
        </div>
      ) : paintings.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: sk.radius, padding: '30px 20px', textAlign: 'center',
          boxShadow: '0 6px 16px rgba(40,30,70,.09)',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#8d83ad',
        }}>
          Nothing here yet — draw something!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
          {paintings.map(p => (
            <div key={p.id} style={{
              background: '#fff', borderRadius: sk.radius, overflow: 'hidden',
              boxShadow: '0 6px 16px rgba(40,30,70,.09)',
            }}>
              {p.photo
                ? <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', height: 118, objectFit: 'cover', display: 'block' }} />
                : <div style={{ height: 118, background: '#F3EFE6' }} />}
              <div style={{ padding: '9px 11px 11px' }}>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 14, color: sk.ink }}>{nameFor(p)}</div>
                <PaintingStatus p={p} sk={sk} />
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onAgain} style={ctaStyle(sk, false)}>Draw again</button>
      <div style={{ height: 20 }} />
    </>
  )
}

function ctaStyle(sk, disabled) {
  return {
    width: '100%', marginTop: 16, padding: '16px', borderRadius: sk.radius - 2, border: 'none',
    background: disabled ? '#d7cfe6' : sk.accent, color: '#fff', cursor: disabled ? 'default' : 'pointer',
    fontFamily: "'Baloo 2', cursive", fontWeight: 600, fontSize: 19,
    boxShadow: disabled ? 'none' : '0 8px 18px rgba(239,133,31,.36)',
  }
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function DrawingsScreen() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const band = bandFor(child?.age)
  const sk = SKINS[band]
  const ageGroup = AGE_GROUP[band]

  const [view, setView] = useState('browse')   // browse|ready|steps|upload|reward|library
  const [drawings, setDrawings] = useState([])
  const [loadingDrawings, setLoadingDrawings] = useState(true)
  const [paintings, setPaintings] = useState([])
  const [loadingPaintings, setLoadingPaintings] = useState(true)
  const [target, setTarget] = useState(null)   // null = free draw
  const [step, setStep] = useState(0)
  const [photo, setPhoto] = useState(null)     // { file, url }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!child?.id) { nav('/child/home', { replace: true }); return }
    getDrawings(ageGroup).then(d => { setDrawings(d); setLoadingDrawings(false) })
    getPaintings(child.id).then(p => { setPaintings(p); setLoadingPaintings(false) })
  }, [])

  // Don't leak the blob preview when the photo is swapped or the screen closes.
  useEffect(() => () => { if (photo?.url) URL.revokeObjectURL(photo.url) }, [photo])

  function pickPhoto(file) {
    if (photo?.url) URL.revokeObjectURL(photo.url)
    setPhoto({ file, url: URL.createObjectURL(file) })
    setError(null)
  }

  function clearPhoto() {
    if (photo?.url) URL.revokeObjectURL(photo.url)
    setPhoto(null)
  }

  async function handleSubmit() {
    if (!photo || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      // Only the event is reported — the server decides the reward.
      const res = await submitPainting(child.id, photo.file, {
        drawingId: target?.id ?? null,
        ageGroup: target ? ageGroup : null,
      })
      setResult(res)
      clearPhoto()
      setView('reward')
      getPaintings(child.id).then(setPaintings)
    } catch (err) {
      setError(err.message || "Couldn't save that — try again?")
    } finally {
      setSubmitting(false)
    }
  }

  function startOver() {
    setTarget(null); setStep(0); setResult(null); clearPhoto(); setView('browse')
  }

  return (
    <div style={{ minHeight: '100dvh', background: sk.bg }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))' }}>
        {view === 'browse' && (
          <Browse sk={sk} drawings={drawings} ageGroup={ageGroup} paintings={paintings} loading={loadingDrawings}
            onPick={d => { setTarget(d); setStep(0); setView('ready') }}
            onFree={() => { setTarget(null); setView('ready') }}
            onLibrary={() => setView('library')}
            onBack={() => nav('/child/home')} />
        )}
        {view === 'ready' && (
          <Ready sk={sk} target={target} ageGroup={ageGroup}
            // Free draw skips the guided steps and goes straight to upload.
            onStart={() => setView(target ? 'steps' : 'upload')}
            onBack={() => setView('browse')} />
        )}
        {view === 'steps' && target && (
          <Steps sk={sk} target={target} ageGroup={ageGroup} step={step} setStep={setStep}
            onFinish={() => setView('upload')} onBack={() => setView('ready')} />
        )}
        {view === 'upload' && (
          <Upload sk={sk} target={target} photo={photo} onPick={pickPhoto} onClear={clearPhoto}
            onSubmit={handleSubmit} submitting={submitting} error={error}
            onBack={() => setView(target ? 'steps' : 'ready')} />
        )}
        {view === 'reward' && (
          <Reward sk={sk} result={result} onLibrary={() => setView('library')} onAgain={startOver} />
        )}
        {view === 'library' && (
          <Library sk={sk} paintings={paintings} drawings={drawings} loading={loadingPaintings}
            onBack={() => setView('browse')} onAgain={startOver} />
        )}
      </div>
    </div>
  )
}
