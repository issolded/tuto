import { stepsFor } from '../lib/drawingSteps'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t, formatDay, localeFor, childLang } from '../lib/i18n'
import { useNavigate } from 'react-router-dom'
import TutoMascot from '../components/TutoMascot'
import { drawingStepUrl, getDrawings, getPaintings, submitPainting, deleteChildPainting } from '../lib/supabase'
import { drawingAlign } from '../lib/drawingAlign'
import Shell, { useIsTabletLandscape } from '../components/Shell'

// ── Age skins ────────────────────────────────────────────────────────────────
// Same flow, three presentations (see SKINS in the design prototype). The
// reward LABEL differs per age; the reward AMOUNT is decided by the server and
// is only ever rendered from its response.
const SKINS = {
  young: {
    bg: 'linear-gradient(180deg,#FFF6E8 0%,#FFE9CF 100%)',
    accent: '#f79433', ink: '#20201e', radius: 22,
    gemIcon: '⭐', stepKey: 'dr_step_lower',
    readyKey: 'dr_ready_young',
  },
  mid: {
    bg: 'linear-gradient(180deg,#F3EEFF 0%,#E4DBFB 100%)',
    accent: '#7c5cd6', ink: '#20201e', radius: 22,
    gemIcon: '◆', stepKey: 'dr_step_upper',
    readyKey: 'dr_ready_mid',
  },
  mature: {
    bg: 'linear-gradient(180deg,#F7F8FB 0%,#ECEEF5 100%)',
    accent: '#5860d8', ink: '#1b1f2a', radius: 14,
    gemIcon: '✦', stepKey: 'dr_step_upper',
    readyKey: 'dr_ready_mature',
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



// The chip VALUES are the catalogue's own words — they filter rows — so they
// stay English here and are translated only on the way to the screen.
const CATEGORIES = ['All', 'Animals', 'Characters', 'Objects', 'Nature']
const CATEGORY_KEY = {
  All: 'dr_all', Animals: 'dr_cat_animals', Characters: 'dr_cat_characters',
  Objects: 'dr_cat_objects', Nature: 'dr_cat_nature',
}
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']
// Stars, not words — "Easy" reads as a judgment when a kid can't even draw it.
// Keys stay 'Easy'/'Medium'/'Hard' to match the `difficulty` values already in
// the drawings table; only the on-screen label changes. 'All' is the one that
// is really a word, so it is the one that needs translating.
const DIFFICULTY_LABEL = { Easy: '★☆☆', Medium: '★★☆', Hard: '★★★' }
// Empty since the September batch: Butterfly, Alien, Rocket and Sun — the four
// this list used to promise — are real drawings now. Kept (rather than deleted)
// because the next set of names to tease goes here.
const LOCKED = []

// The catalogue carries a name column per language: name_en, name_tr. A missing
// translation falls back to English rather than showing the child a raw id.
function drawingName(d, lang) {
  return d?.[`name_${lang}`] || d?.name_en || d?.id || ''
}

// t() with one placeholder — used for the strings that have to wrap a reward
// amount, where the amount does not sit at the same point in every language.
function tf(key, lang, values) {
  return Object.entries(values).reduce((str, [k, v]) => str.replace(`%${k}%`, v), t(key, lang))
}

function fmtDate(iso, lang) {
  try {
    return formatDay(iso, lang)
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
    <div style={{ flex: 1, textAlign: 'center', fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 19, color: sk.ink }}>
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
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  if (p.status === 'approved') {
    return p.reward_amount > 0
      ? { text: `${sk.gemIcon} +${p.reward_amount}`, color: sk.accent }
      : { text: t('dr_approved', lang), color: '#37a06f' }
  }
  if (p.status === 'rejected') return { text: t('dr_not_this_time', lang), color: '#9a93a8' }
  return { text: t('dr_waiting', lang), color: '#b9892f' }
}

function PaintingStatus({ p, sk, compact }) {
  // Read here rather than threaded through props: these are leaves, and a date is the only
  // thing they need a language for.
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
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
        {fmtDate(p.created_at, lang)}
      </div>
    </div>
  )
}

// ── Browse ───────────────────────────────────────────────────────────────────
function Browse({ sk, drawings, ageGroup, paintings, onPick, onFree, onLibrary, onBack, loading, error, onRetry }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const [cat, setCat] = useState('All')
  const [diff, setDiff] = useState('All')
  const shown = drawings
    .filter(d => cat === 'All' || d.category === cat)
    .filter(d => diff === 'All' || d.difficulty === diff)
  const shownLocked = cat === 'All' ? LOCKED : LOCKED.filter(l => l.category === cat)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{t('dr_title', lang)}</Title>
        <button onClick={onLibrary} title={t('dr_my_paintings', lang)} style={{
          width: 42, height: 42, borderRadius: '50%', background: '#fff', border: 'none',
          boxShadow: '0 4px 12px rgba(40,30,70,.12)', cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>🎨</button>
      </div>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8 }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            flexShrink: 0, padding: '8px 15px', borderRadius: 999, cursor: 'pointer',
            border: cat === c ? 'none' : '1.5px solid rgba(32,32,30,.14)',
            background: cat === c ? sk.accent : '#fff',
            color: cat === c ? '#fff' : '#6f6a64',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13,
          }}>{t(CATEGORY_KEY[c], lang)}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12 }}>
        {DIFFICULTIES.map(d => (
          <button key={d} onClick={() => setDiff(d)} style={{
            flexShrink: 0, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
            border: diff === d ? 'none' : '1.5px solid rgba(32,32,30,.14)',
            background: diff === d ? sk.ink : '#fff',
            color: diff === d ? '#fff' : '#8d83ad',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11.5,
          }}>{DIFFICULTY_LABEL[d] ?? t('dr_all', lang)}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#8d83ad' }}>
          {t('dr_loading', lang)}
        </div>
      ) : error ? (
        // Distinct from "no drawings yet" — a failed fetch used to fall
        // through silently to the always-present "Soon" placeholders, which
        // read as every single drawing being locked with no sign anything
        // had gone wrong.
        <div style={{
          textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: sk.radius,
          boxShadow: '0 6px 16px rgba(40,30,70,.09)',
        }}>
          <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink, marginBottom: 6 }}>
            {t('dr_load_failed', lang)}
          </div>
          <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#8d83ad', marginBottom: 16 }}>
            {t('dr_check_conn', lang)}
          </div>
          <button onClick={onRetry} style={{
            padding: '11px 22px', borderRadius: 999, border: 'none', background: sk.accent, color: '#fff',
            fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
          }}>{t('dr_try_again', lang)}</button>
        </div>
      ) : (
        /* Two fixed columns meant a card was half the screen wide whatever the
           screen was: on a sideways iPad each thumbnail came out ~555px and the
           twenty drawings became eight thousand pixels of scrolling. */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 11 }}>
          {shown.map(d => (
            <button key={`${d.id}-${d.age_group}`} onClick={() => onPick(d)} style={{
              background: '#fff', border: 'none', borderRadius: sk.radius, padding: 10,
              boxShadow: '0 6px 16px rgba(40,30,70,.09)', cursor: 'pointer', textAlign: 'center',
            }}>
              <DrawingThumb id={d.id} ageGroup={d.age_group} stepCount={d.step_count}
                category={d.category} radius={sk.radius - 8} />
              <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink, marginTop: 9 }}>{drawingName(d, lang)}</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: sk.accent, marginTop: 3 }}>
                ✎ {d.step_count} {t('dr_steps_unit', lang)}
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
              <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: '#8d83ad', marginTop: 9 }}>{l.name}</div>
              <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 11, color: '#b3a894', marginTop: 3 }}>{t('dr_soon', lang)}</div>
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
          <span style={{ display: 'block', fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 15.5, color: sk.ink }}>
            {t('dr_own_idea', lang)}
          </span>
          <span style={{ display: 'block', fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#8d83ad' }}>
            {t('dr_skip_steps', lang)}
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
            <span style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink }}>{t('dr_my_paintings', lang)}</span>
            <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 12, color: '#8d83ad' }}>{paintings.length}</span>
            <button onClick={onLibrary} style={{
              marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 12.5, color: sk.accent, padding: 0,
            }}>{t('dr_open_library', lang)}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {paintings.slice(0, 3).map(p => (
              <button key={p.id} onClick={onLibrary} style={{
                border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'center',
              }}>
                {p.photo
                  ? <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', background: PANEL_BG, borderRadius: sk.radius - 8, display: 'block' }} />
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
          {t('dr_open_library', lang)}
        </button>
      )}
      <div style={{ height: 16 }} />
    </>
  )
}

// ── Ready ────────────────────────────────────────────────────────────────────
function Ready({ sk, target, ageGroup, onStart, onBack }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{target ? drawingName(target, lang) : t('dr_my_own_idea', lang)}</Title>
        <div style={{ width: 42 }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
        <TutoMascot size={130} />
      </div>

      <div style={{
        background: '#fff', borderRadius: sk.radius, padding: '16px 18px', margin: '14px 0',
        boxShadow: '0 6px 16px rgba(40,30,70,.09)', textAlign: 'center',
        fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16.5, color: sk.ink, whiteSpace: 'pre-line',
      }}>
        {t(sk.readyKey, lang)}
      </div>

      {target && (
        <div style={{ maxWidth: 200, margin: '4px auto 10px' }}>
          <DrawingThumb id={target.id} ageGroup={ageGroup} stepCount={target.step_count}
            category={target.category} radius={sk.radius - 8} />
        </div>
      )}

      <button onClick={onStart} style={ctaStyle(sk, false)}>{t('dr_im_ready', lang)}</button>
    </>
  )
}

// Leaving the guided steps mid-drawing loses your place in the panels — the
// top-left arrow is the ONLY way out of this screen (stepping back through
// panels is the footer Back button's job instead), so it always confirms
// first rather than silently dropping progress.
// Generic two-button confirm dialog — used for leaving a guided drawing
// mid-flow and for deleting a painting, so both share one implementation.
function ConfirmModal({ sk, title, body, cancelLabel, confirmLabel, confirmDanger, onCancel, onConfirm }) {
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
        <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 18, color: sk.ink }}>
          {title}
        </div>
        <div style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13, color: '#8d83ad', marginTop: 8, lineHeight: 1.4 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '13px', borderRadius: sk.radius - 8, border: '1.5px solid rgba(32,32,30,.14)',
            background: '#fff', fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#6f6a64', cursor: 'pointer',
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '13px', borderRadius: sk.radius - 8, border: 'none',
            background: confirmDanger ? '#e5484d' : sk.accent, color: '#fff',
            fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── Guided steps ─────────────────────────────────────────────────────────────
function Steps({ sk, target, ageGroup, step, setStep, onFinish, onBack }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const total = target.step_count
  const wide = useIsTabletLandscape()
  // Only drawings whose steps have been checked against their pictures get words.
  const tips = stepsFor(target.id, lang) || []
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
  const poorerAlign = drawingAlign(target.id, poorerStep)
  const richerAlign = drawingAlign(target.id, richerStep)

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

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 10px' }}>
      <BackBtn onClick={() => setConfirmExit(true)} />
      <Title sk={sk}>{drawingName(target, lang)}</Title>
      <div style={{ width: 42 }} />
    </div>
  )

  const counter = (
    <div style={{
      textAlign: 'center', fontFamily: 'Nunito, sans-serif', fontWeight: 800,
      fontSize: 13, color: sk.accent, marginBottom: wide ? 0 : 8,
    }}>
      {t(sk.stepKey, lang)} {step + 1}/{total}
    </div>
  )

  const progress = (
    <div style={{ display: 'flex', gap: 4, marginBottom: wide ? 0 : 14 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 5, borderRadius: 999,
          background: i <= step ? sk.accent : 'rgba(32,32,30,.13)',
        }} />
      ))}
    </div>
  )

  const panel = (
      /* Two stacked layers so a step change fades the new ink in over the old,
         instead of hard-cutting to the next panel — see baseStep/revealed above. */
      <div style={{
        background: CATEGORY_TINT[target.category] || PANEL_BG, borderRadius: sk.radius, padding: 10,
        boxShadow: '0 6px 16px rgba(40,30,70,.09)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(wide ? { flex: 1, minHeight: 0, minWidth: 0 } : null),
      }}>
        {/* Sideways, the square takes its size from the HEIGHT it has left over.
            Sized from the width — as it is in a column — a 1180px content column
            makes a 1128px panel on an 820px-tall screen, and Next lands half a
            screen below the fold. */}
        <div style={wide
          ? { position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: '1' }
          : { position: 'relative', width: '100%', aspectRatio: '1' }}>
          <img
            src={drawingStepUrl(target.id, ageGroup, poorerStep + 1)}
            alt={`${drawingName(target, lang)} ${t(sk.stepKey, lang)} ${poorerStep + 1}`}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: sk.radius - 8,
              // A couple of sets' source panels aren't perfectly registered
              // step to step (some slide, one — anime-face's final reveal —
              // is a genuine zoom jump) — without this the shared ink visibly
              // slides or lurches during the cross-fade instead of just
              // gaining new strokes in place. Static per-step correction, not
              // part of the opacity transition; scale is innermost (applied
              // to the panel first, about its own center) so it matches how
              // the correction was searched for — see drawingAlign.js.
              transform: `translate(${poorerAlign.dx}%, ${poorerAlign.dy}%) scale(${poorerAlign.scale})`,
            }}
          />
          {step !== baseStep && (
            <img
              key={`${richerStep}-${forward ? 'in' : 'out'}`}
              src={drawingStepUrl(target.id, ageGroup, richerStep + 1)}
              alt={`${drawingName(target, lang)} ${t(sk.stepKey, lang)} ${richerStep + 1}`}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', borderRadius: sk.radius - 8,
                transform: `translate(${richerAlign.dx}%, ${richerAlign.dy}%) scale(${richerAlign.scale})`,
                // Forward: hidden → shown (ink fading in). Back: shown → hidden
                // (ink fading out, since richerStep is where we came FROM).
                opacity: forward ? (revealed ? 1 : 0) : (revealed ? 0 : 1),
                transition: 'opacity 420ms ease',
              }}
            />
          )}
        </div>
      </div>
  )

  const tip = tips[step] && (
    <div style={{
      marginTop: wide ? 0 : 12, background: '#fff', borderRadius: sk.radius, padding: '13px 16px',
      boxShadow: '0 6px 16px rgba(40,30,70,.09)',
      fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 15.5, color: sk.ink, textAlign: 'center',
    }}>
      {tips[step]}
    </div>
  )

  const nav = (
    /* Equal-width pair: this is the ONLY way to move between panels now that
       the top arrow is exit-only, so Back needs to be as prominent as Next. */
    <div style={{ display: 'flex', gap: 9, marginTop: wide ? 0 : 16, paddingBottom: wide ? 0 : 20 }}>
      <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} style={{
        flex: 1, padding: '14px 10px', borderRadius: sk.radius - 4, border: '1.5px solid rgba(32,32,30,.14)',
        background: '#fff', cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? .45 : 1,
        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14.5, color: '#6f6a64',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}><span>←</span> {t('dr_back', lang)}</button>
      <button onClick={() => (isLast ? onFinish() : setStep(step + 1))} style={{
        ...ctaStyle(sk, false), flex: 1, marginTop: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        {isLast ? t('dr_i_drew_it', lang) : <>{t('dr_next', lang)} <span>→</span></>}
      </button>
    </div>
  )

  const exitModal = confirmExit && (
    <ConfirmModal sk={sk}
      title={t('dr_leave_drawing', lang)} body={t('dr_leave_body', lang)}
      cancelLabel={t('dr_keep_drawing', lang)} confirmLabel={t('dr_leave', lang)}
      onCancel={() => setConfirmExit(false)} onConfirm={onBack} />
  )

  // Sideways the panel goes beside its controls rather than above them, so the
  // drawing gets the full height of the screen and Next never leaves it.
  if (wide) return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {header}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 18, paddingBottom: 14 }}>
        {panel}
        <div style={{ flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {counter}
          {progress}
          {tip}
          <div style={{ flex: 1 }} />
          {nav}
        </div>
      </div>
      {exitModal}
    </div>
  )

  return (
    <>
      {header}
      {counter}
      {progress}
      {panel}
      {tip}
      {nav}
      {exitModal}
    </>
  )
}

// ── Upload ───────────────────────────────────────────────────────────────────
function Upload({ sk, target, photo, onPick, onClear, onSubmit, submitting, error, onBack }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const fileRef = useRef(null)
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{target ? drawingName(target, lang) : t('dr_my_own_idea', lang)}</Title>
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
        <span style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 500, fontSize: 15.5, color: sk.ink }}>
          {t('dr_take_photo', lang)}
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
          fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: '#8d83ad',
        }}>📷<br />{t('dr_add_photo', lang)}</button>
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
        {submitting ? t('dr_saving', lang) : t('dr_add_to_library', lang)}
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
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  return (
    <div style={{ textAlign: 'center', paddingTop: 20 }}>
      <TutoMascot size={140} />
      <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 25, color: sk.ink, marginTop: 12 }}>
        {t('dr_great_job', lang)}
      </div>
      <div style={{
        fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 14.5, color: '#6f6a64',
        margin: '10px 22px 18px', lineHeight: 1.45,
      }}>
        {t('dr_sent_to_grownup', lang)}
      </div>

      <div style={{
        display: 'inline-block', background: '#fff', borderRadius: 999, padding: '11px 22px',
        boxShadow: '0 6px 16px rgba(40,30,70,.10)',
        fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 17, color: '#b9892f',
      }}>
        {tf('dr_waiting_then', lang, { reward: sk.gemIcon })}
      </div>

      {result?.painting?.photo && (
        <img src={result.painting.photo} alt="" style={{
          width: '100%', borderRadius: sk.radius, marginTop: 20, display: 'block',
        }} />
      )}

      <button onClick={onLibrary} style={ctaStyle(sk, false)}>{t('dr_see_library', lang)}</button>
      <button onClick={onAgain} style={{
        width: '100%', marginTop: 9, padding: '13px', borderRadius: sk.radius - 4,
        border: '1.5px solid rgba(32,32,30,.14)', background: '#fff', cursor: 'pointer',
        fontFamily: 'Nunito, sans-serif', fontWeight: 800, fontSize: 14, color: '#6f6a64',
      }}>{t('dr_draw_again', lang)}</button>
    </div>
  )
}

// ── Library ──────────────────────────────────────────────────────────────────
function Library({ sk, paintings, drawings, loading, onBack, onAgain, onDelete }) {
  const lang = childLang(JSON.parse(localStorage.getItem('child') || 'null'))
  const [confirmTarget, setConfirmTarget] = useState(null) // painting awaiting delete confirmation
  const [deletingId, setDeletingId] = useState(null)
  const [viewing, setViewing] = useState(null)

  const nameFor = p => {
    if (!p.drawing_id) return t('dr_my_own_drawing', lang)
    const d = drawings.find(x => x.id === p.drawing_id)
    return d ? drawingName(d, lang) : p.drawing_id
  }

  async function confirmDelete() {
    const p = confirmTarget
    setConfirmTarget(null)
    setDeletingId(p.id)
    await onDelete(p)
    setDeletingId(null)
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 14px' }}>
        <BackBtn onClick={onBack} />
        <Title sk={sk}>{t('dr_my_paintings', lang)}</Title>
        <div style={{ width: 42 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#8d83ad' }}>
          {t('dr_loading_short', lang)}
        </div>
      ) : paintings.length === 0 ? (
        <div style={{
          background: '#fff', borderRadius: sk.radius, padding: '30px 20px', textAlign: 'center',
          boxShadow: '0 6px 16px rgba(40,30,70,.09)',
          fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13.5, color: '#8d83ad',
        }}>
          {t('dr_nothing_yet', lang)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 11 }}>
          {paintings.map(p => (
            <div key={p.id} style={{
              position: 'relative', background: '#fff', borderRadius: sk.radius, overflow: 'hidden',
              boxShadow: '0 6px 16px rgba(40,30,70,.09)', opacity: deletingId === p.id ? .4 : 1,
            }}>
              {p.photo
                ? <button onClick={() => setViewing(p)} aria-label={nameFor(p)} style={{
                    display: 'block', width: '100%', padding: 0, border: 'none', cursor: 'pointer', background: PANEL_BG,
                  }}>
                    {/* A drawing is the thing itself, not decoration for a card: a fixed-height
                        cover crop of a portrait photo showed a band across its middle. */}
                    <img src={p.photo} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', display: 'block' }} />
                  </button>
                : <div style={{ aspectRatio: '1', background: PANEL_BG }} />}
              <button onClick={() => setConfirmTarget(p)} disabled={deletingId === p.id} aria-label={t('dr_delete', lang)} style={{
                position: 'absolute', top: 7, right: 7, width: 26, height: 26, borderRadius: '50%', border: 'none',
                background: 'rgba(30,30,25,.55)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
              <div style={{ padding: '9px 11px 11px' }}>
                <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 14, color: sk.ink }}>{nameFor(p)}</div>
                <PaintingStatus p={p} sk={sk} />
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onAgain} style={ctaStyle(sk, false)}>{t('dr_draw_again', lang)}</button>
      <div style={{ height: 20 }} />

      {viewing && (
        <div onClick={() => setViewing(null)} style={{
          position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(28,26,34,.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 18,
        }}>
          <img src={viewing.photo} alt={nameFor(viewing)} style={{
            maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 14,
            animation: 'ttPop .24s cubic-bezier(.2,.9,.3,1.2) both',
          }} />
          <div style={{ fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 17, color: '#fff', textAlign: 'center' }}>
            {nameFor(viewing)}
          </div>
          <button onClick={() => setViewing(null)} style={{
            border: 'none', borderRadius: 999, padding: '12px 30px', background: '#fff', cursor: 'pointer',
            fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 16, color: sk.ink,
          }}>{t('dr_close', lang)}</button>
        </div>
      )}

      {confirmTarget && (
        <ConfirmModal sk={sk}
          title={t('dr_delete_painting', lang)}
          body={confirmTarget.reward_amount > 0
            ? tf('dr_delete_body_kept', lang, { reward: `${sk.gemIcon} +${confirmTarget.reward_amount}` })
            : t('dr_delete_body', lang)}
          cancelLabel={t('dr_keep_it', lang)} confirmLabel={t('dr_delete', lang)} confirmDanger
          onCancel={() => setConfirmTarget(null)} onConfirm={confirmDelete} />
      )}
    </>
  )
}

function ctaStyle(sk, disabled) {
  return {
    width: '100%', marginTop: 16, padding: '16px', borderRadius: sk.radius - 2, border: 'none',
    background: disabled ? '#d7cfe6' : sk.accent, color: '#fff', cursor: disabled ? 'default' : 'pointer',
    fontFamily: "'TrRound', 'Baloo 2', cursive", fontWeight: 600, fontSize: 19,
    boxShadow: disabled ? 'none' : '0 8px 18px rgba(239,133,31,.36)',
  }
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function DrawingsScreen() {
  const nav = useNavigate()
  const child = JSON.parse(localStorage.getItem('child') || 'null')
  const lang = childLang(child)
  const band = bandFor(child?.age)
  const sk = SKINS[band]
  const ageGroup = AGE_GROUP[band]

  const [view, setView] = useState('browse')   // browse|ready|steps|upload|reward|library
  const [drawings, setDrawings] = useState([])
  const [loadingDrawings, setLoadingDrawings] = useState(true)
  const [drawingsError, setDrawingsError] = useState(false)
  const [paintings, setPaintings] = useState([])
  const [loadingPaintings, setLoadingPaintings] = useState(true)
  const [target, setTarget] = useState(null)   // null = free draw
  const [step, setStep] = useState(0)
  const [photo, setPhoto] = useState(null)     // { file, url }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  function loadDrawings() {
    setLoadingDrawings(true)
    setDrawingsError(false)
    getDrawings(ageGroup)
      .then(setDrawings)
      .catch(() => setDrawingsError(true))
      .finally(() => setLoadingDrawings(false))
  }

  useEffect(() => {
    if (!child?.id) { nav('/child/home', { replace: true }); return }
    loadDrawings()
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

  // Read out here, not in the catch: scripts/i18n-check.mjs only sees locals of
  // the function it is standing in, and a nested handler reading the screen's
  // `lang` reads to it as an out-of-scope variable.
  const saveFailed = t('dr_save_failed', lang)

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
      setError(err.message || saveFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function startOver() {
    setTarget(null); setStep(0); setResult(null); clearPhoto(); setView('browse')
  }

  // Removes the row and its photo server-side; never touches any gem already
  // awarded — see deleteChildPainting.
  async function handleDeletePainting(p) {
    try {
      await deleteChildPainting(child.id, p.id)
      setPaintings(prev => prev.filter(x => x.id !== p.id))
    } catch {
      // The Library grid just un-dims the card (deletingId reset) — the
      // child can tap the × again.
    }
  }

  return (
    <Shell background={sk.bg}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 16px calc(14px + env(safe-area-inset-bottom))' }}>
        {view === 'browse' && (
          <Browse sk={sk} drawings={drawings} ageGroup={ageGroup} paintings={paintings}
            loading={loadingDrawings} error={drawingsError} onRetry={loadDrawings}
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
            onBack={() => setView('browse')} onAgain={startOver} onDelete={handleDeletePainting} />
        )}
      </div>
    </Shell>
  )
}
