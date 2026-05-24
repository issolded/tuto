import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateStoryInput, evaluateStory, checkTitleSpelling } from '../lib/gemini'
import TutoMascot from '../components/TutoMascot'

const STORY_IDEAS = {
  '5-7': [
    // Animals
    { emoji: '🐉', title: 'Friendly dragon',      topic: 'A dragon afraid of fire makes an unlikely best friend.' },
    { emoji: '🐠', title: 'Flying fish',           topic: 'A fish who dreams of flying finally gets his wish.' },
    { emoji: '🐻', title: "Bear's big day",        topic: 'A bear cub sets off on his very first solo adventure.' },
    { emoji: '🐘', title: 'Tiny elephant',         topic: 'The smallest elephant in the herd turns out to be the bravest.' },
    { emoji: '🦋', title: 'Butterfly secret',      topic: 'A caterpillar is too scared to become a butterfly.' },
    { emoji: '🐸', title: 'Frog finds home',       topic: 'A frog whose pond dried up must find a brand-new home.' },
    { emoji: '🦁', title: 'Lion learns kindness',  topic: 'The loudest lion in the jungle discovers that being gentle is true strength.' },
    { emoji: '🐧', title: 'Penguin goes north',    topic: 'A penguin travels to the jungle and discovers it is not so different after all.' },
    // Magic objects
    { emoji: '🌈', title: 'Magic paintbrush',      topic: 'A paintbrush that brings every drawing to life causes wonderful chaos.' },
    { emoji: '🎩', title: 'Wishing hat',           topic: 'A hat that grants wishes but always gets them slightly wrong.' },
    { emoji: '🪄', title: 'Broken wand',           topic: 'A young wizard finds a wand that does the opposite of everything asked.' },
    { emoji: '🔑', title: 'Golden key',            topic: 'A golden key opens any door but always leads somewhere unexpected.' },
    { emoji: '📚', title: 'Book comes alive',      topic: 'Every story a child reads leaps right off the page into her bedroom.' },
    { emoji: '🧤', title: 'Candy gloves',          topic: 'A pair of gloves that turns anything you touch into candy.' },
    // Friendship
    { emoji: '🌻', title: 'Sunflower friend',      topic: 'A lonely sunflower in the garden makes friends with a raindrop.' },
    { emoji: '🦄', title: 'Unicorn mystery',       topic: 'A unicorn who lost her horn learns that real magic comes from friendship.' },
    { emoji: '🐺', title: 'Wolf best friend',      topic: 'A wolf and a rabbit decide to become best friends despite what everyone says.' },
    { emoji: '👾', title: 'Monster next door',     topic: 'The new neighbor is a little monster who just wants someone to play with.' },
    { emoji: '🤝', title: 'New kid in town',       topic: 'Moving to a new town is scary until a talking squirrel shows you around.' },
    // Adventure
    { emoji: '🚀', title: 'Candy planet trip',     topic: 'A rocket ship takes two kids to a planet made entirely of sweets.' },
    { emoji: '🏝️', title: 'Island treasure',      topic: 'Three friends follow a hand-drawn map to a tiny island treasure.' },
    { emoji: '🌋', title: 'Volcano city',          topic: 'A child discovers a magical city hidden inside a sleeping volcano.' },
    { emoji: '🎠', title: 'Runaway carousel',      topic: 'A merry-go-round horse jumps off and gallops deep into the forest.' },
    { emoji: '🛸', title: 'Backyard aliens',       topic: 'Two tiny aliens crash-land in a backyard and need help fixing their ship.' },
    { emoji: '🧭', title: 'Enchanted woods',       topic: 'A glowing trail leads a child deep into the enchanted forest.' },
    // Food worlds
    { emoji: '🍄', title: 'Mushroom village',      topic: 'A tiny village inside a mushroom is in danger of being stepped on.' },
    { emoji: '🍕', title: 'Pizza kingdom',         topic: 'A kingdom ruled by a pizza-obsessed queen suddenly runs out of cheese.' },
    { emoji: '🍦', title: 'Ice cream river',       topic: 'A river of melting ice cream threatens to flood the cookie castle.' },
    { emoji: '🍬', title: 'Candy forest',          topic: 'Every tree in the enchanted forest grows a different kind of candy.' },
    { emoji: '🎂', title: 'Cake runs away',        topic: 'A birthday cake gets up and walks away before anyone can eat it.' },
    // Small heroes
    { emoji: '⭐', title: 'Falling star',          topic: 'A little star falls from the sky and must find its way home before sunrise.' },
    { emoji: '🐛', title: 'Tiny hero',             topic: 'The tiniest caterpillar in the garden saves everyone from a hungry bird.' },
    { emoji: '🧸', title: 'Teddy saves night',     topic: 'A teddy bear comes alive at midnight to chase away bad dreams.' },
    { emoji: '🌙', title: 'Moon keeper',           topic: 'A child is chosen to keep the moon shining while its guardian sleeps.' },
    { emoji: '🐝', title: 'Brave little bee',      topic: 'A bee too small to carry pollen finds a way to save the whole hive.' },
    { emoji: '🌱', title: 'Tiny seed',             topic: 'A seed no one believed in grows into the most magical tree in the valley.' },
    { emoji: '🐭', title: 'Mouse big heart',       topic: 'The smallest mouse in the city has the biggest heart and saves the day.' },
    { emoji: '🌊', title: 'Wave rider',            topic: 'A child surfs a magical wave that carries her to the bottom of the ocean.' },
    { emoji: '🌸', title: 'Cherry blossom wish',   topic: 'Every petal that falls from the cherry tree grants one small wish.' },
    { emoji: '🧒', title: 'Kid fixes storm',       topic: 'After a big storm, a child rebuilds the neighborhood one act of kindness at a time.' },
  ],
  '8-10': [
    // Mystery
    { emoji: '🗺️', title: 'Hidden map',           topic: 'A mysterious map in an old library leads to a buried secret.' },
    { emoji: '🕵️', title: 'Missing trophy',       topic: "The school's championship trophy vanishes the night before the big game." },
    { emoji: '🚪', title: 'Door thirteen',         topic: 'A hotel has no thirteenth floor — until one morning a new door appears.' },
    { emoji: '🖼️', title: 'Painting blinks',      topic: 'An old painting in the school hallway blinks when no one is watching.' },
    { emoji: '📷', title: 'Ghost in photo',        topic: 'Every photo taken in the old house shows a figure that should not be there.' },
    { emoji: '🔦', title: 'Midnight signal',       topic: 'A flashing light from an abandoned lighthouse starts sending coded messages.' },
    { emoji: '🧳', title: 'Lost suitcase',         topic: 'A suitcase left at the train station contains clues to a decades-old mystery.' },
    // Detective
    { emoji: '🔍', title: 'Stolen gems case',      topic: 'A kid detective is hired to find the stolen gems from the town museum.' },
    { emoji: '🐾', title: 'Paw print clues',       topic: 'Strange paw prints around the neighborhood lead to an unbelievable discovery.' },
    { emoji: '📝', title: 'Anonymous notes',       topic: 'Someone is leaving mysterious notes in lockers with clues to a hidden truth.' },
    { emoji: '🎪', title: 'Circus thief',          topic: 'Animals keep disappearing from the traveling circus and only one kid notices.' },
    { emoji: '🌆', title: 'Vanished city',         topic: 'A map shows an entire city that nobody living nearby has ever heard of.' },
    // Time travel
    { emoji: '⏰', title: 'Medieval time slip',    topic: 'A broken clock sends a kid back to medieval times right before a great battle.' },
    { emoji: '📺', title: 'TV time portal',        topic: 'Pressing the wrong remote button sends a child into a black-and-white 1950s TV show.' },
    { emoji: '🪙', title: 'Ancient coin',          topic: 'A coin found in the park turns out to be a portal to ancient Rome.' },
    { emoji: '🔭', title: 'Telescope to past',     topic: 'A telescope that lets you see the past shows something that must be changed.' },
    { emoji: '📜', title: 'Letter from future',    topic: 'A letter arrives addressed to you from your future self with one urgent warning.' },
    // Supernatural powers
    { emoji: '🌊', title: 'Ocean breather',        topic: 'A girl discovers she can breathe underwater and finds a hidden civilization.' },
    { emoji: '🌡️', title: 'Weather changer',      topic: 'A girl realizes her emotions are literally changing the weather around her school.' },
    { emoji: '👁️', title: 'Truth seeker',         topic: 'A child who can always tell when someone is lying must use that power wisely.' },
    { emoji: '📡', title: 'Animal talker',         topic: 'After a lightning strike, a kid can suddenly understand every animal around him.' },
    { emoji: '🧲', title: 'Metal mover',           topic: 'A child discovers she can move metal with her mind but cannot control it yet.' },
    { emoji: '🦅', title: 'Feather glider',        topic: 'After touching a falcon feather, a boy can glide short distances through the air.' },
    // Friendship challenges
    { emoji: '🤖', title: 'Robot best friend',     topic: 'A robot built to be the perfect friend starts developing real feelings.' },
    { emoji: '🏰', title: 'Forgotten castle',      topic: 'Two rivals get trapped in an abandoned castle and must work together to escape.' },
    { emoji: '🦊', title: 'Honest fox',            topic: 'A fox who lies to get what he wants must learn honesty to save his friendships.' },
    { emoji: '🎭', title: 'Stage fright rivals',   topic: 'Best friends compete for the same lead role and risk breaking their bond.' },
    { emoji: '🏕️', title: 'Camp rivals',          topic: 'Two rival cabin teams discover their whole rivalry was based on a lie.' },
    { emoji: '🧪', title: 'Science fair feud',     topic: 'Former best friends competing in a science fair must team up when things go wrong.' },
    // Animal stories
    { emoji: '🐺', title: 'Wolf pack outcast',     topic: 'A wolf rejected by his pack must find a new place to belong in the wild.' },
    { emoji: '🦁', title: 'Lion fears dark',       topic: 'The bravest lion on the savanna has a secret — he is terrified of the dark.' },
    { emoji: '🐬', title: 'Dolphin lost at sea',   topic: 'A dolphin who swam too far from home must navigate back across the ocean.' },
    { emoji: '🐘', title: 'Elephant memory',       topic: 'An old elephant who remembers everything uses her memories to save the herd.' },
    { emoji: '🦓', title: 'Stripes mystery',       topic: 'A zebra born without stripes must prove she belongs in the herd.' },
    { emoji: '🐙', title: 'Octopus artist',        topic: 'An octopus who changes color for art rather than camouflage becomes a legend.' },
    { emoji: '🦜', title: 'Parrot keeps secret',   topic: 'A parrot who overheard a dangerous secret must decide whether to reveal it.' },
    { emoji: '🐊', title: 'Crocodile protector',   topic: 'A crocodile feared by everyone in the river turns out to be protecting them all.' },
    { emoji: '🦔', title: 'Hedgehog hero',         topic: 'A hedgehog who cannot hug anyone without hurting them finds a clever solution.' },
    { emoji: '🐼', title: 'Panda leaves home',     topic: 'A young panda leaves his bamboo forest in search of the world beyond the mountains.' },
    { emoji: '🦈', title: 'Gentle shark',          topic: 'The most feared shark in the ocean just wants to make friends but nobody will stay long enough.' },
  ],
  '11+': [
    // Dystopia
    { emoji: '📖', title: 'Books banned',          topic: 'In a world where reading is illegal, a teenager starts an underground library.' },
    { emoji: '🎭', title: 'Emotions monitored',    topic: 'In a society that monitors all feelings, a girl starts experiencing ones she cannot explain.' },
    { emoji: '🕐', title: 'Sunlight rationed',     topic: 'Citizens are only allowed four hours of sunlight per day and someone is stealing the rest.' },
    { emoji: '🤐', title: 'Silence law',           topic: 'A city where speaking is outlawed forces a teenage boy to find another way to fight back.' },
    { emoji: '🧠', title: 'Memory wipe',           topic: 'At sixteen, everyone gets their memories erased — except one girl who remembers everything.' },
    { emoji: '🔒', title: 'Walls that shrink',     topic: "A walled city's borders shrink by one meter every year and the government calls it progress." },
    { emoji: '🏷️', title: 'No names left',        topic: 'In a near-future world, everyone is assigned a number instead of a name at birth.' },
    // Sci-fi
    { emoji: '💻', title: 'Trapped in game',       topic: 'Getting trapped inside a video game means the only way out is to finish it.' },
    { emoji: '🛸', title: 'First contact',         topic: 'A teenager intercepts an alien signal and must decide whether to respond.' },
    { emoji: '🌌', title: 'Parallel self',         topic: 'A school experiment opens a window to a parallel universe version of yourself.' },
    { emoji: '🤖', title: 'AI awakens',            topic: 'A teen discovers the AI she built for a school project has become truly conscious.' },
    { emoji: '🧬', title: 'Unedited',             topic: 'In a world where parents design children genetically, one unedited teen searches for identity.' },
    { emoji: '🌙', title: 'Moon born',             topic: 'A teenager born on the first moon colony has never stood on Earth and longs to go.' },
    { emoji: '⚡', title: 'Grid crash',            topic: 'When all technology fails permanently, a girl with old-world skills becomes essential.' },
    // Identity
    { emoji: '🪞', title: 'Mirror shows truth',    topic: 'A mirror in an antique shop shows the person you are supposed to become — and it is terrifying.' },
    { emoji: '🎭', title: 'Two versions',          topic: 'A teenager who plays a completely different character at school and at home must finally choose one.' },
    { emoji: '🧬', title: 'DNA surprise',          topic: 'A DNA test reveals you are not biologically related to either of your parents.' },
    { emoji: '🌐', title: 'Digital double',        topic: 'Your online persona becomes so famous that strangers start mistaking it for the real you.' },
    { emoji: '🧩', title: 'Missing piece',         topic: 'A puzzle found in a grandparent attic reveals the truth about who your family really is.' },
    { emoji: '🎒', title: 'Wrong life',            topic: 'A mix-up at birth means two teenagers have been living each other\'s intended lives.' },
    // Family secrets
    { emoji: '🏚️', title: "Grandmother's house",  topic: "Clearing out a grandmother's house after she passes reveals a secret life she never mentioned." },
    { emoji: '📷', title: 'Erased ancestor',       topic: 'A photograph found behind a wall shows a family member who was erased from history.' },
    { emoji: '🔮', title: 'Future vision',         topic: 'You start seeing the future in flashes and realize a family member has hidden the same ability.' },
    { emoji: '✉️', title: 'Unread letters',        topic: 'A box of unopened letters in the attic reveals your parents have been hiding a sibling.' },
    { emoji: '🗝️', title: 'Key to past',          topic: 'A key found in a grandfather clock opens a room that changes everything you knew.' },
    { emoji: '🕯️', title: 'Shadow lineage',       topic: 'Every generation of her family has been tasked with guarding a dangerous secret — now it is her turn.' },
    // Nature-human conflict
    { emoji: '🏔️', title: 'Mountain awakens',     topic: 'An expedition reveals the mountain is a living organism responding to human damage.' },
    { emoji: '🌊', title: 'Sea reclaims city',     topic: 'A coastal city slowly sinking into the ocean has one teenager who refuses to leave.' },
    { emoji: '🌿', title: 'Forest fights back',    topic: 'A forest cut down for decades begins fighting back in ways no one can explain.' },
    { emoji: '🦠', title: 'Nature resets',         topic: 'A virus that only affects polluters spreads through the population and a teen must find its source.' },
    { emoji: '🐺', title: 'Too smart wolves',      topic: 'A rewilding project goes wrong when the reintroduced wolves seem smarter than wolves should be.' },
    { emoji: '☀️', title: 'Sun goes quiet',        topic: 'Solar activity drops, crops fail, and a teenager on a farm must find a new way to grow food.' },
    { emoji: '🌾', title: 'Last harvest',          topic: 'A girl protecting the last seed bank after a massive drought makes a choice that changes history.' },
    // Technology
    { emoji: '🎵', title: 'Sound controls minds',  topic: 'A music app discovered to be altering memories without anyone\'s consent.' },
    { emoji: '📱', title: 'App knows all',         topic: 'A new app predicts your every decision before you make it — and starts making them for you.' },
    { emoji: '👓', title: 'AR reality',            topic: 'AR glasses everyone wears begin showing a version of reality that slowly replaces the real one.' },
    { emoji: '🔋', title: 'Body battery',          topic: 'A new energy implant that powers devices from body heat begins changing the people who have it.' },
    { emoji: '🖥️', title: 'AI best friend',       topic: 'An AI friend designed to be perfect begins doing things its creator never programmed.' },
    { emoji: '📡', title: 'Deep space signal',     topic: 'A signal decoded by a teenage hacker contains instructions for a machine that should not exist.' },
    { emoji: '🌑', title: 'Shadow realm',          topic: 'A world where shadows live independent lives is discovered through a glitch in a surveillance system.' },
  ],
}

function getIdeasForAge(age) {
  const n = Number(age) || 7
  const pool = n <= 7 ? STORY_IDEAS['5-7'] : n <= 10 ? STORY_IDEAS['8-10'] : STORY_IDEAS['11+']
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 4)
}

function getTutoMessage(age) {
  const n = Number(age) || 7
  if (n <= 7) return "I can't wait to see what happens in your story! 🤩\nGrab a pen and let your imagination run wild!\nWhen you're done, show me what you wrote!"
  if (n <= 10) return "I'm SO curious about your story! ✨\nWhere will it take me? Who will I meet?\nWrite it down and let's go on this adventure together!"
  return "Every great story starts with a single word...\nI wonder what world you'll create. 🌍\nWrite it down — I promise I'll be your first reader!"
}

const ANIM = `
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes confettiFall {
  0%   { transform: translateY(-10px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
}
`

const CONFETTI_COLORS = ['#FF6B35','#FFD93D','#2EC486','#7C5CBF','#4ECDC4','#FF8CC8','#A8E6CF','#FFB347']

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }

function buildCorrectedText(text, errors, states) {
  let result = text
  errors.forEach((e, i) => {
    if (states[i] !== 'fixed') return
    result = result.replace(new RegExp(`\\b${escRe(e.wrong)}\\b`, 'gi'), e.correct)
  })
  return result
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildSpellingHTML(text, errors, states, activeError) {
  if (!text) return ''
  if (!errors.length) return escHtml(text)

  const wrongMap = {}
  errors.forEach((e, i) => {
    const key = e.wrong.toLowerCase().trim()
    if (!wrongMap[key]) wrongMap[key] = []
    wrongMap[key].push(i)
  })
  const seenCount = {}
  const tokens = text.split(/(\s+|[.,!?;:()\-"']+)/)

  return tokens.map(token => {
    const clean = token.toLowerCase().replace(/[^a-z0-9']/g, '')
    const candidates = wrongMap[clean]
    if (!candidates) return escHtml(token)

    seenCount[clean] = (seenCount[clean] || 0)
    const errIdx = candidates.find(ci => (errors[ci].index || 0) === seenCount[clean]) ?? candidates[0]
    seenCount[clean]++

    const state = states[errIdx] || 'pending'
    const color = state === 'fixed' ? '#2EC486' : '#FF6B35'
    const dec = state === 'not_sure' ? 'none' : 'underline'
    const bg = activeError === errIdx ? 'rgba(255,107,53,0.12)' : 'transparent'
    return `<span data-err="${errIdx}" style="color:${color};font-weight:800;cursor:pointer;text-decoration:${dec};text-decoration-color:${color};background:${bg};border-radius:4px;padding:0 2px">${escHtml(token)}</span>`
  }).join('')
}

const CARD_COLORS = ['#E8F5E9', '#E3F2FD', '#FFF8E1', '#FCE4EC']
const BG = 'linear-gradient(180deg, #E8F5E9 0%, #F1F8E9 100%)'

function BackBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'rgba(46,196,134,0.15)', border: 'none', borderRadius: 12, width: 40, height: 40, fontSize: 18, cursor: 'pointer', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      ←
    </button>
  )
}

export default function StoriesScreen() {
  const nav = useNavigate()
  const child = JSON.parse(sessionStorage.getItem('tuto_child') || 'null')

  const [loadingStories, setLoadingStories] = useState(true)
  const [stories, setStories] = useState([])
  const [ideas] = useState(() => getIdeasForAge(child?.age))
  const [selectedIdea, setSelectedIdea] = useState(null)
  const [showFreeText, setShowFreeText] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [moderating, setModerating] = useState(false)
  const [moderationError, setModerationError] = useState(false)
  const [startNew, setStartNew] = useState(false)
  const [step, setStep] = useState('idle') // 'idle' | 'title' | 'write'
  const [chosenIdea, setChosenIdea] = useState(null)
  const [storyTitle, setStoryTitle] = useState('')
  const [photos, setPhotos] = useState([])
  const fileRef = useRef(null)
  const [evalResult, setEvalResult] = useState(null)
  const [spellingState, setSpellingState] = useState([])
  const [activeError, setActiveError] = useState(null)
  const editorRef = useRef(null)
  const editableTextRef = useRef('')
  const [checkingTitle, setCheckingTitle] = useState(false)
  const [titleSuggestion, setTitleSuggestion] = useState(null)

  const handleTitleNext = async () => {
    if (!storyTitle.trim() || checkingTitle) return
    setCheckingTitle(true)
    try {
      const result = await checkTitleSpelling(storyTitle.trim())
      if (result.has_errors && result.corrected && result.corrected !== storyTitle.trim()) {
        setTitleSuggestion(result.corrected)
      } else {
        setStep('write')
      }
    } catch {
      setStep('write')
    }
    setCheckingTitle(false)
  }

  // Initialize editor when entering spelling step
  useEffect(() => {
    if (step !== 'spelling' || !editorRef.current || !evalResult) return
    editableTextRef.current = evalResult.transcribed_text || ''
    editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh highlights after popup interactions (cursor already lost, safe to update)
  useEffect(() => {
    if (step !== 'spelling' || !editorRef.current || !evalResult) return
    editorRef.current.innerHTML = buildSpellingHTML(editableTextRef.current, evalResult.spelling_errors || [], spellingState, activeError)
  }, [spellingState, activeError]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEvaluation = async () => {
    setStep('evaluating')
    try {
      const result = await evaluateStory(photos, chosenIdea?.topic || '', child?.age || 7, 'en')
      setEvalResult(result)
      console.log('[evaluateStory] spelling_errors:', result.spelling_errors)
      console.log('[evaluateStory] transcribed_text:', result.transcribed_text)
      setSpellingState((result.spelling_errors || []).map(() => 'pending'))
      setStep('encourage')
    } catch {
      setStep('write')
    }
  }

  const goToCorrections = async () => {
    const errors = evalResult?.spelling_errors || []
    if (errors.length > 0 && child?.id) {
      await supabase.from('spelling_errors').insert(
        errors.map((e, i) => ({ child_id: child.id, wrong: e.wrong, correct: e.correct, state: spellingState[i] || 'pending' }))
      ).then(() => {})
    }
    setStep('corrected')
  }

  const finishStory = async (status) => {
    const baseText = editableTextRef.current || evalResult?.transcribed_text || ''
    const corrected = buildCorrectedText(baseText, evalResult?.spelling_errors || [], spellingState)
    if (child?.id) {
      await supabase.from('stories').insert({ child_id: child.id, title: displayTitle, topic: chosenIdea?.topic || '', transcribed_text: baseText, corrected_text: corrected, status, gems_earned: evalResult?.gems_earned || 0 }).then(() => {})
      await supabase.from('bt_ledger').insert({ child_id: child.id, amount: evalResult?.gems_earned || 0, source: 'story' }).then(() => {})
    }
    setStep('done')
  }

  useEffect(() => {
    if (!child?.id) { setLoadingStories(false); return }
    supabase.from('stories').select('*').eq('child_id', child.id).then(({ data }) => {
      setStories(data || [])
      setLoadingStories(false)
    })
  }, [])

  const confirmIdea = (idea) => {
    setChosenIdea(idea)
    setSelectedIdea(null)
    setStoryTitle('')
    setStep('title')
  }

  const submitFreeText = async () => {
    if (!freeText.trim()) return
    setModerating(true)
    setModerationError(false)
    try {
      const result = await validateStoryInput(freeText.trim(), child?.age || 7, 'en')
      if (result.ok) {
        setChosenIdea({ emoji: '✏️', title: freeText.trim(), topic: freeText.trim() })
        setStoryTitle('')
        setStep('title')
        return
      }
      setModerationError(true)
      setTimeout(() => setModerationError(false), 3500)
    } catch {
      setChosenIdea({ emoji: '✏️', title: freeText.trim(), topic: freeText.trim() })
      setStoryTitle('')
      setStep('title')
      return
    }
    setModerating(false)
  }

  const displayTitle = storyTitle.trim() || `${child?.name ?? 'Your'}'s Untitled Story ✨`

  // ── STEP: TITLE ────────────────────────────────────────────────────────────
  if (step === 'title') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => { setStep('idle'); setChosenIdea(null) }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px', gap: 0 }}>
          <TutoMascot size={140} expression="excited" style={{ animation: 'fadeUp 0.4s ease both' }} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginTop: 20, marginBottom: 28, animation: 'fadeUp 0.4s ease 0.1s both' }}>
            What will your story be called? 📖
          </div>
          <input
            type="text"
            value={storyTitle}
            onChange={e => { setStoryTitle(e.target.value); setTitleSuggestion(null) }}
            placeholder="My amazing story..."
            autoFocus
            style={{ width: '100%', borderRadius: 18, border: '2.5px solid #A5D6A7', padding: '16px 18px', fontSize: 16, fontFamily: 'Nunito, sans-serif', fontWeight: 700, color: '#2D5016', background: 'white', outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 12px rgba(46,196,134,0.10)', animation: 'fadeUp 0.4s ease 0.15s both' }}
            onKeyDown={e => e.key === 'Enter' && storyTitle.trim() && !titleSuggestion && handleTitleNext()}
          />

          {titleSuggestion ? (
            <div style={{ width: '100%', marginTop: 16, background: 'white', borderRadius: 20, padding: '16px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', animation: 'fadeUp 0.25s ease both', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <TutoMascot size={48} expression="excited" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', lineHeight: 1.5 }}>
                  Did you mean: <span style={{ color: '#2EC486', fontWeight: 800 }}>"{titleSuggestion}"</span>? ✨
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setStoryTitle(titleSuggestion); setTitleSuggestion(null); setStep('write') }}
                  style={{ flex: 1, background: '#2EC486', border: 'none', borderRadius: 14, padding: '12px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 800, color: 'white', cursor: 'pointer' }}
                >
                  Yes, fix it!
                </button>
                <button
                  onClick={() => { setTitleSuggestion(null); setStep('write') }}
                  style={{ flex: 1, background: '#F0FFF4', border: '2px solid #A5D6A7', borderRadius: 14, padding: '12px', fontFamily: "'Baloo 2', cursive", fontSize: 14, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
                >
                  No, keep mine
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleTitleNext}
              disabled={!storyTitle.trim() || checkingTitle}
              style={{ width: '100%', marginTop: 16, background: '#2EC486', border: 'none', borderRadius: 18, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white', cursor: storyTitle.trim() && !checkingTitle ? 'pointer' : 'default', opacity: storyTitle.trim() && !checkingTitle ? 1 : 0.4, boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}
            >
              {checkingTitle ? 'Checking... ✨' : 'Next →'}
            </button>
          )}
          <button
            onClick={() => { setStoryTitle(''); setTitleSuggestion(null); setStep('write') }}
            style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 14, textDecoration: 'underline', animation: 'fadeUp 0.4s ease 0.25s both' }}
          >
            I'll think of a title later
          </button>
        </div>
      </div>
    )
  }

  // ── STEP: WRITE ────────────────────────────────────────────────────────────
  if (step === 'write') {
    const addPhoto = (file) => setPhotos(prev => [...prev, file])
    const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i))

    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => { setStep('title'); setPhotos([]) }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px', gap: 0 }}>
          <div style={{ fontSize: 72, lineHeight: 1, animation: 'fadeUp 0.35s ease both' }}>{chosenIdea?.emoji ?? '✏️'}</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginTop: 14, marginBottom: 24, lineHeight: 1.3, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            {displayTitle}
          </div>

          {/* Tuto message card */}
          <div style={{ background: 'white', borderRadius: 24, padding: '24px 20px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 24, animation: 'fadeUp 0.35s ease 0.15s both', boxSizing: 'border-box' }}>
            <TutoMascot size={100} expression={photos.length > 0 ? 'excited' : 'default'} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#2D5016', textAlign: 'center', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {photos.length > 0
                ? 'Great! Add more pages if you wrote more,\nor submit when you\'re ready! 🌟'
                : getTutoMessage(child?.age)}
            </div>
          </div>

          {/* Hidden file input — reset value so same file can be re-picked */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) addPhoto(file)
              e.target.value = ''
            }}
          />

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {photos.map((file, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', animation: 'fadeUp 0.25s ease both' }}>
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Page ${i + 1}`}
                    style={{ width: 64, height: 64, objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#2D5016', flex: 1 }}>Page {i + 1}</span>
                  <button
                    onClick={() => removePhoto(i)}
                    style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 20, cursor: 'pointer', padding: '0 16px 0 0', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add another page — visible after first photo, max 10 */}
          {photos.length > 0 && photos.length < 10 && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', background: 'none', border: '2.5px dashed #A5D6A7', borderRadius: 18, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer', marginBottom: 14 }}
            >
              📸 Add another page
            </button>
          )}

          {/* First photo CTA */}
          {photos.length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', background: '#2D5016', border: 'none', borderRadius: 20, padding: '20px', fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 6px 20px rgba(45,80,22,0.25)', animation: 'fadeUp 0.35s ease 0.2s both' }}
            >
              I'm ready, Tuto! 📸
            </button>
          )}

          {/* Submit */}
          {photos.length > 0 && (
            <button
              onClick={startEvaluation}
              style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 19, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)', animation: 'fadeUp 0.25s ease both' }}
            >
              I'm done! 🎉
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── STEP: EVALUATING ──────────────────────────────────────────────────────
  if (step === 'evaluating') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 28px' }}>
        <style>{ANIM}</style>
        <TutoMascot size={160} expression="thinking" style={{ animation: 'fadeUp 0.4s ease both' }} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', textAlign: 'center', animation: 'fadeUp 0.4s ease 0.1s both' }}>
          Reading your story... ✨
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', textAlign: 'center', animation: 'fadeUp 0.4s ease 0.2s both' }}>
          Just a moment!
        </div>
      </div>
    )
  }

  // ── STEP: ENCOURAGE ───────────────────────────────────────────────────────
  if (step === 'encourage') {
    const isBlocked = evalResult?.has_profanity || evalResult?.too_short
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('write')} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 28px 48px' }}>
          <TutoMascot size={160} expression={isBlocked ? 'default' : 'excited'} style={{ animation: 'fadeUp 0.4s ease both' }} />
          <div style={{ background: 'white', borderRadius: 28, padding: '28px 24px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', textAlign: 'center', marginTop: 24, boxSizing: 'border-box', animation: 'fadeUp 0.4s ease 0.1s both' }}>
            {evalResult?.has_profanity ? (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                Hmm, let's keep our story friendly!<br />Some words aren't great for stories. Try again? 😊
              </div>
            ) : evalResult?.too_short ? (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                Hmm, I think there's more to this story!<br />Can you write a bit more? 📝
              </div>
            ) : (
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', lineHeight: 1.7 }}>
                {evalResult?.encouragement}
              </div>
            )}
          </div>
          {isBlocked ? (
            <button onClick={() => setStep('write')} style={{ width: '100%', marginTop: 24, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              ← Go back and try again
            </button>
          ) : (
            <button onClick={() => setStep('spelling')} style={{ width: '100%', marginTop: 24, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.4s ease 0.2s both' }}>
              Let's look at your story! →
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── STEP: SPELLING ────────────────────────────────────────────────────────
  if (step === 'spelling') {
    const errors = evalResult?.spelling_errors || []
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('encourage')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 8, animation: 'fadeUp 0.35s ease both' }}>
            Your story! 📖
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', marginBottom: 16, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            {errors.length > 0
              ? <>Tap the <span style={{ color: '#FF6B35', fontWeight: 800 }}>orange words</span> to fix spelling, or edit directly if something looks wrong ✏️</>
              : 'Edit directly if something looks wrong ✏️'}
          </div>
          <div
            style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 20, animation: 'fadeUp 0.35s ease 0.1s both' }}
          >
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={e => { editableTextRef.current = e.currentTarget.innerText }}
              onClick={e => {
                const errIdx = e.target.dataset?.err
                if (errIdx !== undefined) setActiveError(activeError === Number(errIdx) ? null : Number(errIdx))
              }}
              style={{ outline: 'none', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15, fontWeight: 600, color: '#2D2D2D', minHeight: 80 }}
            />
          </div>
          <button onClick={goToCorrections} style={{ width: '100%', background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.30)', animation: 'fadeUp 0.35s ease 0.15s both' }}>
            Looks good! →
          </button>
        </div>

        {/* Spelling popup */}
        {activeError !== null && errors[activeError] && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,80,22,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }} onClick={() => setActiveError(null)}>
            <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '28px 28px 0 0', padding: '28px 24px 44px', animation: 'fadeUp 0.25s ease both' }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 36, height: 4, background: '#E8E8F0', borderRadius: 4, margin: '0 auto 20px' }} />
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: '#2D5016', textAlign: 'center', marginBottom: 20 }}>
                Did you mean <span style={{ color: '#2EC486' }}>"{errors[activeError].correct}"</span>?
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'fixed' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#2EC486', border: 'none', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: 'white', cursor: 'pointer' }}
                >
                  ✅ Yes, fix it!
                </button>
                <button
                  onClick={() => { setSpellingState(prev => prev.map((s, i) => i === activeError ? 'not_sure' : s)); setActiveError(null) }}
                  style={{ flex: 1, background: '#F0FFF4', border: '2px solid #A5D6A7', borderRadius: 16, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 800, color: '#6A9956', cursor: 'pointer' }}
                >
                  🤷 Not sure
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── STEP: CORRECTED ───────────────────────────────────────────────────────
  if (step === 'corrected') {
    const corrected = buildCorrectedText(editableTextRef.current || evalResult?.transcribed_text || '', evalResult?.spelling_errors || [], spellingState)
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 0' }}>
          <BackBtn onClick={() => setStep('spelling')} />
        </div>
        <div style={{ flex: 1, padding: '0 24px 48px' }}>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 22, fontWeight: 800, color: '#2D5016', marginBottom: 16, animation: 'fadeUp 0.35s ease both' }}>
            {displayTitle}
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: '16px 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 16, animation: 'fadeUp 0.35s ease 0.08s both', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <TutoMascot size={64} expression="excited" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: '#2D5016', lineHeight: 1.7, paddingTop: 8 }}>
              Here's your story with the fixes! How does it look? ✨
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', marginBottom: 24, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#2D2D2D', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{corrected}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp 0.35s ease 0.16s both' }}>
            <button onClick={() => finishStory('completed')} style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}>
              🏆 My story is finished!
            </button>
            <button onClick={() => finishStory('in_progress')} style={{ background: 'white', border: '2.5px solid #A5D6A7', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}>
              📝 I'll add more later
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP: DONE ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', position: 'relative', overflow: 'hidden' }}>
        <style>{ANIM}</style>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {CONFETTI_COLORS.map((c, i) => (
            <div key={i} style={{ position: 'absolute', top: '-12px', left: `${(i * 12.5) % 100}%`, width: 10, height: 10, borderRadius: '50%', background: c, animation: `confettiFall ${1.4 + (i % 4) * 0.3}s ease ${(i * 0.13) % 1.3}s infinite` }} />
          ))}
        </div>
        <TutoMascot size={180} expression="proud" style={{ animation: 'fadeUp 0.4s ease both' }} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 34, fontWeight: 900, color: '#2D5016', marginTop: 20, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          Amazing! 🎉
        </div>
        <div style={{ background: 'white', borderRadius: 28, padding: '20px 40px', marginTop: 20, boxShadow: '0 6px 24px rgba(46,196,134,0.20)', animation: 'fadeUp 0.4s ease 0.15s both', textAlign: 'center' }}>
          <div style={{ fontSize: 52, fontWeight: 900, fontFamily: "'Baloo 2', cursive", color: '#FF6B35', lineHeight: 1 }}>
            +{evalResult?.gems_earned ?? 0}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#6A9956', marginTop: 4 }}>Gems earned! ⭐</div>
        </div>
        <button
          onClick={() => nav('/child/stories')}
          style={{ marginTop: 32, background: '#2EC486', border: 'none', borderRadius: 20, padding: '18px 36px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)', animation: 'fadeUp 0.4s ease 0.2s both' }}
        >
          Back to My Stories
        </button>
      </div>
    )
  }

  const inProgress = stories.find(s => s.status === 'in_progress')
  const showDurum2 = !loadingStories && stories.length > 0 && !startNew

  // ── DURUM 2 ────────────────────────────────────────────────────────────────
  if (showDurum2) {
    return (
      <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <style>{ANIM}</style>
        <div style={{ padding: '56px 24px 24px' }}>
          <BackBtn onClick={() => nav('/child/home')} />
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: '#2D5016', lineHeight: 1.2 }}>
            {child?.name ?? 'Friend'}, the Creative Writer ✏️
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', marginTop: 6 }}>What would you like to do?</div>
        </div>

        <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button
            onClick={() => setStartNew(true)}
            style={{ background: 'white', border: '3px solid #A5D6A7', borderRadius: 28, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', boxShadow: '0 6px 24px rgba(46,196,134,0.15)', animation: 'fadeUp 0.35s ease both', textAlign: 'left', width: '100%' }}
          >
            <span style={{ fontSize: 56 }}>🌱</span>
            <div>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', marginBottom: 6 }}>Begin a New Story</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956' }}>Start a brand new adventure!</div>
            </div>
          </button>

          {inProgress && (
            <button
              onClick={() => nav('/child/reading', { state: { storyId: inProgress.id, storyTitle: inProgress.title, mode: 'continue' } })}
              style={{ background: 'white', border: '3px solid #C8E6C9', borderRadius: 28, padding: '32px 24px', display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', boxShadow: '0 6px 24px rgba(46,196,134,0.10)', animation: 'fadeUp 0.35s ease 0.1s both', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 56 }}>🌳</span>
              <div>
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', marginBottom: 6 }}>Continue My Story</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inProgress.title || 'Pick up where you left off'}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── DURUM 1 ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <style>{ANIM}</style>

      <div style={{ padding: '56px 24px 20px' }}>
        <BackBtn onClick={() => startNew ? setStartNew(false) : nav('/child/home')} />
        <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 26, fontWeight: 800, color: '#2D5016', lineHeight: 1.2 }}>
          {child?.name ?? 'Friend'}, the Creative Writer ✏️
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', marginTop: 6 }}>
          {showFreeText ? 'What would you like to write about?' : 'Pick a story idea to get started!'}
        </div>
      </div>

      <div style={{ padding: '0 24px 40px', flex: 1 }}>
        {showFreeText ? (
          // Free text mode
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {moderationError ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '28px 20px', background: 'white', borderRadius: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', animation: 'fadeUp 0.3s ease both' }}>
                <TutoMascot size={120} expression="default" />
                <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: '#2D5016', textAlign: 'center' }}>
                  Hmm, let's try something a bit different! 😊
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#6A9956', textAlign: 'center', lineHeight: 1.6 }}>
                  How about a story about animals, adventures, or magic?
                </div>
              </div>
            ) : (
              <>
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  placeholder="e.g. A dragon who is afraid of fire..."
                  rows={5}
                  style={{ width: '100%', borderRadius: 20, border: '2.5px solid #A5D6A7', padding: '16px', fontSize: 15, fontFamily: 'Nunito, sans-serif', fontWeight: 600, color: '#2D5016', background: 'white', resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.6 }}
                />
                <button
                  onClick={submitFreeText}
                  disabled={moderating || !freeText.trim()}
                  style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 18, fontWeight: 800, color: 'white', cursor: freeText.trim() && !moderating ? 'pointer' : 'default', opacity: freeText.trim() ? 1 : 0.5, boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
                >
                  {moderating ? 'Checking... ✨' : "Let's Go! 🚀"}
                </button>
              </>
            )}
            <button
              onClick={() => { setShowFreeText(false); setFreeText(''); setModerationError(false) }}
              style={{ background: 'none', border: 'none', color: '#6A9956', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textAlign: 'left' }}
            >
              ← Back to ideas
            </button>
          </div>
        ) : (
          // Idea grid mode
          <>
            {ideas.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {ideas.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIdea(idea)}
                    style={{ background: CARD_COLORS[i % CARD_COLORS.length], borderRadius: 24, border: '2.5px solid transparent', padding: '20px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', aspectRatio: '1', textAlign: 'center', animation: `fadeUp 0.4s ease ${i * 0.08}s both` }}
                    onTouchStart={e => e.currentTarget.style.transform = 'scale(0.95)'}
                    onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <span style={{ fontSize: 42, lineHeight: 1 }}>{idea.emoji}</span>
                    <span style={{ fontFamily: "'Baloo 2', cursive", fontSize: 13, fontWeight: 800, color: '#2D5016', lineHeight: 1.3 }}>{idea.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#6A9956', fontSize: 15, fontWeight: 600 }}>
                Couldn't load ideas — try your own! ✏️
              </div>
            )}

            <button
              onClick={() => setShowFreeText(true)}
              style={{ background: 'none', border: '2.5px dashed #A5D6A7', borderRadius: 20, padding: '14px', width: '100%', marginTop: 16, fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
            >
              ✏️ Or write your own idea
            </button>
          </>
        )}
      </div>

      {/* Topic modal */}
      {selectedIdea && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,80,22,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', width: '100%', maxWidth: 430, borderRadius: '32px 32px 0 0', padding: '32px 28px 48px', display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ width: 40, height: 4, background: '#E8E8F0', borderRadius: 4, alignSelf: 'center' }} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
              <span style={{ fontSize: 64 }}>{selectedIdea.emoji}</span>
              <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: 20, fontWeight: 800, color: '#2D5016', lineHeight: 1.3 }}>
                {child?.name ?? 'Your'}'s story about{' '}
                <span style={{ color: '#2EC486' }}>{selectedIdea.topic}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6A9956', lineHeight: 1.7 }}>{selectedIdea.description}</div>
            </div>
            <button
              onClick={() => confirmIdea(selectedIdea)}
              style={{ background: '#2EC486', border: 'none', borderRadius: 20, padding: '16px', fontFamily: "'Baloo 2', cursive", fontSize: 17, fontWeight: 800, color: 'white', cursor: 'pointer', boxShadow: '0 4px 16px rgba(46,196,134,0.35)' }}
            >
              Yes, let's write this! ✅
            </button>
            <button
              onClick={() => setSelectedIdea(null)}
              style={{ background: '#F0FFF4', border: 'none', borderRadius: 20, padding: '14px', fontFamily: "'Baloo 2', cursive", fontSize: 15, fontWeight: 700, color: '#6A9956', cursor: 'pointer' }}
            >
              No, show me others 🔄
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
