import { WORDS, CLOZE, BE_FRAMES, PLURAL_WORDS, SENTENCES, QUESTIONS, PASSAGES, CONTENT_VERSION } from './content.js'

export const ENGINE_VERSION = '1'
export const SKILLS = {
  meaning: { domain: 'Vocabulary', label: 'Word meanings' },
  cloze: { domain: 'Vocabulary', label: 'Words in sentences' },
  build: { domain: 'Spelling', label: 'Build a word' },
  missing: { domain: 'Spelling', label: 'Complete a word' },
  capital: { domain: 'Grammar', label: 'Capital letters' },
  punctuation: { domain: 'Grammar', label: 'Sentence endings' },
  plural: { domain: 'Grammar', label: 'Regular plurals' },
  be: { domain: 'Grammar', label: 'Am, is, are' },
  detail: { domain: 'Reading', label: 'Find a detail' },
  sequence: { domain: 'Reading', label: 'Order of events' },
}
export const COVERAGE = { words: WORDS.length, sentenceFrames: CLOZE.length + BE_FRAMES.length,
  passages: PASSAGES.length, skills: Object.keys(SKILLS).length }
export function random(seed) {
  let state = seed >>> 0
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296 }
}
function shuffle(a, rng) {
  const out = [...a]
  for (let i=out.length-1; i>0; i--) { const j=Math.floor(rng()*(i+1)); [out[i],out[j]]=[out[j],out[i]] }
  return out
}
const choose = (a, r) => a[Math.floor(r()*a.length)]
const wordFor = w => WORDS.find(x=>x.word===w)
const beAnswer = f => f.person === 'first' ? 'am' : f.number === 'plural' ? 'are' : 'is'
const normalize = s => String(s ?? '').trim().toLowerCase()
const spellingWords = WORDS.filter(w => w.word.length >= 3 && w.word.length <= 6)

// Local review lab only: includes answer keys. A future child API must project public fields.
export function generateItem(skill, seed=1) {
  if (!SKILLS[skill]) throw new Error(`Unknown literacy skill: ${skill}`)
  const r=random(seed), q={ skill, seed, contentVersion:CONTENT_VERSION, engineVersion:ENGINE_VERSION,
    variety:'shared', mode:'choice', primarySkill:skill }
  let answer, wrong=[]
  if (skill==='meaning' || skill==='missing' || skill==='build') {
    const w=choose(skill==='meaning'?WORDS:spellingWords,r)
    q.family=w.id; q.sourceId=w.id; q.meaning=w.meaning
    if(skill==='meaning') {
      q.prompt=`Which word means “${w.meaning}”?`; answer=w.word
      wrong=shuffle(WORDS.filter(x=>x.id!==w.id),r).slice(0,2).map(x=>x.word)
      q.hint='Read the whole description. Think about what the thing does or what makes it different.'
    } else if(skill==='build') {
      q.mode='letters'; q.prompt=`Build the word: ${w.meaning}.`; answer=w.word
      q.letters=shuffle([...w.word].map((letter,i)=>({id:i,letter})),r)
      if(q.letters.map(x=>x.letter).join('')===w.word) q.letters.reverse()
      q.hint='Use every letter once. Check the meaning, then look carefully at the beginning and ending.'
    } else {
      const at=Math.floor(r()*w.word.length)
      q.at=at; q.stem=w.word.slice(0,at)+'_'+w.word.slice(at+1)
      q.prompt=`Complete the word: ${w.meaning}.`; answer=w.word[at]
      wrong=shuffle([...'abcdefghijklmnopqrstuvwxyz'].filter(x=>x!==answer),r).slice(0,2)
      q.hint='Use the description to think of the whole word. Check which letter belongs in the gap.'
    }
    q.explanation=`${w.word}: ${w.meaning}.`
  } else if(skill==='cloze') {
    const c=choose(CLOZE,r); q.family=c.id; q.sourceId=c.id; q.prompt='Choose the word that fits.';q.stem=c.text
    answer=c.answer;wrong=c.wrong;q.hint='Read the sentence with each choice. Which one makes sense here?'
    q.explanation=c.text.replace('___',answer)
  } else if(skill==='be') {
    const f=choose(BE_FRAMES,r);q.family=f.id;q.sourceId=f.id;q.prompt='Choose the word that fits.'
    q.stem=`${f.subject} ___ ${f.predicate}.`;answer=beAnswer(f);wrong=['am','is','are'].filter(x=>x!==answer)
    q.hint='Look at the person or thing before the gap. Is it “I”, one other person or thing, or more than one?'
    q.explanation=`${f.subject} ${answer} ${f.predicate}. ${f.person==='first'?'Use “am” with “I”.':f.number==='plural'?'Use “are” with “you”, “we”, “they” and plural subjects.':'Use “is” with “he”, “she”, “it” and one named person or thing.'}`
  } else if(skill==='plural') {
    const w=choose(PLURAL_WORDS,r);q.family=wordFor(w).id;q.sourceId=w
    q.prompt=`One ${w}. Two ___?`;answer=w+'s';wrong=[w,w+"'s"]
    q.hint='The number is more than one. Think about how this regular noun changes.'
    q.explanation=`The plural of “${w}” is “${answer}”. Add s; an apostrophe does not make this plural.`
  } else if(skill==='capital') {
    const i=Math.floor(r()*SENTENCES.length),s=SENTENCES[i];q.family=`sentence-${i}`;q.sourceId=i
    q.prompt='Choose the sentence with the correct capital letters.';answer=s
    wrong=[s[0].toLowerCase()+s.slice(1),s.replace(/ [a-z]/,x=>x.toUpperCase())]
    q.hint='Check the first letter of the sentence. Ordinary words inside the sentence do not need a capital letter.'
    q.explanation=`${s} Start a sentence with a capital letter. The word “I” also always has a capital letter.`
  } else if(skill==='punctuation') {
    const question=r()<0.5, list=question?QUESTIONS:SENTENCES, i=Math.floor(r()*list.length)
    q.family=`${question?'question':'sentence'}-${i}`;q.sourceId={question,index:i}
    q.prompt='Choose the ending mark.';q.stem=list[i].slice(0,-1)+' ___';answer=question?'?':'.';wrong=[question?'.':'?',',']
    q.hint='Does this sentence ask something, or does it tell you something?'
    q.explanation=`${list[i]} ${question?'This sentence asks a question, so it ends with ?.':'This sentence tells something, so it ends with a dot (.).'}`
  } else {
    const p=choose(PASSAGES,r);q.family=`passage-${p.id}`;q.sourceId=p.id;q.passage={title:p.title,sentences:p.sentences}
    if(skill==='detail') {
      const i=Math.floor(r()*p.details.length),d=p.details[i];q.detailIndex=i
      q.prompt=d[0];answer=d[1];wrong=d.slice(2,4);q.evidence=[d[4]]
      q.hint='Look back at the text. Find the sentence that answers this question.'
      q.explanation=`${answer} The text says: “${p.sentences[d[4]]}”`
    } else {
      q.prompt='Which event happens first?';answer=p.events[0];wrong=p.events.slice(1)
      q.evidence=[0];q.hint='Look back at the beginning of the text. Compare when the three events happen.'
      q.explanation=`First: ${p.events[0]} Then: ${p.events[1]} Last: ${p.events[2]}`
    }
  }
  q.answer=answer
  if(q.mode==='choice') q.options=shuffle([answer,...wrong],r).map((text,i)=>({id:`o${i}`,text}))
  q.id=`${CONTENT_VERSION}:${ENGINE_VERSION}:${skill}:${seed}`
  const errors=validateItem(q)
  if(errors.length) throw new Error(`${q.id}: ${errors.join('; ')}`)
  return q
}

// Re-derive accepted answers from the authored source, not the item's answer key.
export function acceptedAnswers(q) {
  if(['meaning','missing','build'].includes(q.skill)) {
    const w=WORDS.find(x=>x.id===q.sourceId)
    return w ? [q.skill==='missing'?w.word[q.at]:w.word] : []
  }
  if(q.skill==='cloze') return [CLOZE.find(x=>x.id===q.sourceId)?.answer]
  if(q.skill==='be') { const f=BE_FRAMES.find(x=>x.id===q.sourceId);return f?[beAnswer(f)]:[] }
  if(q.skill==='plural') return PLURAL_WORDS.includes(q.sourceId)?[q.sourceId+'s']:[]
  if(q.skill==='capital') return [SENTENCES[q.sourceId]]
  if(q.skill==='punctuation') return [q.sourceId.question?'?':'.']
  const p=PASSAGES.find(x=>x.id===q.sourceId)
  return p?[q.skill==='detail'?p.details[q.detailIndex]?.[1]:p.events[0]]:[]
}
export function validateItem(q) {
  const errors=[], accepted=acceptedAnswers(q)
  if(!accepted.includes(q.answer))errors.push('Answer disagrees with source')
  if(!q.hint || !q.explanation || !q.primarySkill)errors.push('Missing teaching metadata')
  if(q.mode==='choice') {
    if(q.options.length!==3 || new Set(q.options.map(o=>o.text)).size!==3)errors.push('Options must be distinct')
    if(q.options.filter(o=>accepted.includes(o.text)).length!==1)errors.push('Expected one accepted option')
  }
  if(q.mode==='letters' && q.letters.map(x=>x.letter).sort().join('')!==[...q.answer].sort().join(''))errors.push('Letter inventory mismatch')
  if(q.passage && !q.evidence.every(i=>typeof q.passage.sentences[i]==='string'))errors.push('Missing text evidence')
  return errors
}
export function generateSession(seed=1, skill='all', limit=10, avoidFamilies=[]) {
  if(!Number.isInteger(limit)||limit<1||limit>50)throw new Error('Session limit must be 1–50')
  const types=skill==='all'?shuffle(Object.keys(SKILLS),random(seed)): [skill]
  const used=new Set(avoidFamilies),items=[]
  for(let n=0;n<limit;n++) {
    const type=types[n%types.length]
    let found=null
    for(let retry=0;retry<500;retry++) {
      const q=generateItem(type,(seed+Math.imul(n+1,104729)+retry*7919)>>>0)
      if(!used.has(q.family)){found=q;break}
    }
    if(!found)break // Explicitly shorter, never silently repeats or changes skill.
    used.add(found.family);items.push(found)
  }
  return { seed, items, exhausted:items.length<limit, contentVersion:CONTENT_VERSION }
}
export function markAnswer(q, response, {hintUsed=false, skipped=false}={}) {
  const selected=q.mode==='choice'?q.options.find(o=>o.id===response)?.text:normalize(response)
  const correct=!skipped && (q.mode==='choice'?selected===q.answer:selected===normalize(q.answer))
  const selectedWord = q.skill === 'meaning' && !correct ? wordFor(selected) : null
  const contrast = selectedWord ? `“${selectedWord.word}” means ${selectedWord.meaning}. ` : ''
  return {itemId:q.id,skill:q.skill,family:q.family,correct,hintUsed,skipped,
    independent:correct&&!hintUsed, response: selected ?? '', answer:q.answer,
    explanation: correct||skipped?q.explanation:`${contrast}${q.mode==='choice'&&selected?`“${selected}” does not fit this question. `:''}${q.explanation}` }
}
export function summarize(attempts) {
  return Object.entries(SKILLS).map(([skill,meta])=>{
    const a=attempts.filter(x=>x.skill===skill)
    return {skill,...meta,seen:a.length,independent:a.filter(x=>x.independent).length,
      supported:a.filter(x=>x.correct&&!x.independent).length,needsPractice:a.filter(x=>!x.correct).length}
  }).filter(x=>x.seen)
}
