import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`

function langInstruction(language) {
  return language === 'tr'
    ? 'All text fields (feedback, child_message, questions) must be in Turkish.'
    : 'All text fields (feedback, child_message, questions) must be in English.'
}

function childMessageGuide(n, language) {
  const isTr = language === 'tr'
  if (n <= 7) return isTr
    ? 'child_message: exactly 1 sentence, very simple Turkish words, lots of emojis. Example if completed: "Harika! Çok güzel yapmışsın! 🌟" Example if not: "Bir daha dener misin? Neredeyse oldu! 💪"'
    : 'child_message: exactly 1 sentence, very simple English words, lots of emojis. Example if completed: "Amazing job! You did it! 🌟" Example if not: "Want to try again? So close! 💪"'
  if (n <= 10) return isTr
    ? 'child_message: 1-2 sentences, warm and friendly Turkish, include emojis. Example if completed: "Süper iş çıkardın, tebrikler! 🎉" Example if not: "Çok az kaldı, tekrar dene! 💪"'
    : 'child_message: 1-2 sentences, warm and friendly English, include emojis. Example if completed: "Great work, well done! 🎉" Example if not: "Almost there, try again! 💪"'
  return isTr
    ? 'child_message: 1-2 sentences, encouraging and mature Turkish, minimal emojis. Example if completed: "Harika bir iş çıkardın, devam et!" Example if not: "Bir dahaki sefere daha iyi olacak, pes etme."'
    : 'child_message: 1-2 sentences, encouraging and mature English, minimal emojis. Example if completed: "Excellent work, keep it up!" Example if not: "Better luck next time, don\'t give up."'
}

function buildEvalPrompt(taskType, age, language = 'en') {
  const n = Number(age) || 7
  const lang = langInstruction(language)
  const msgGuide = childMessageGuide(n, language)
  switch (taskType) {
    case 'math':
      return `This photo shows a ${n}-year-old child's math homework. Count the questions and correct answers. IMPORTANT: This is a child's handwriting — it will be messy and imperfect. Try hard to read each digit correctly even if poorly drawn. When in doubt, assume the answer is correct. Only mark an answer wrong if it is clearly and unambiguously incorrect. Do not penalize for handwriting quality — only mathematical accuracy matters. ${lang} Return JSON only: {total, correct, score, feedback, gem_earned, generated_questions} where gem_earned = 30 if score >= 60 else 0, generated_questions is a string array of the math problems found in the photo`
    case 'writing':
      return `This photo shows a ${n}-year-old child's handwritten composition. Evaluate content, length and spelling appropriately for their age. ${lang} Return JSON only: {score, feedback, gem_earned, generated_questions} where gem_earned = 30 if score >= 60 else 0, generated_questions is a string array of the writing topics or prompts identified`
    case 'reading':
      return `These photos show a ${n}-year-old child's book pages and written summary. Does the summary match the content? Evaluate appropriately for their age. ${lang} Return JSON only: {score, feedback, gem_earned, generated_questions} where gem_earned = 30 if score >= 60 else 0, generated_questions is a string array of comprehension questions about the text`
    case 'chore':
      return `You are evaluating a child's household chore photo. Be GENEROUS and FLEXIBLE in your evaluation. The child did SOME tidying - reward the effort. If you can see ANY sign of tidiness, cleanliness or organization, mark as completed. Do NOT ask for specific chore details - just evaluate what you see. If the space looks reasonably tidy, score 100. If somewhat tidy, score 70-90. Only score below 50 if the space is clearly messy. ${lang} ${msgGuide}. Never show technical explanations to the child. Return JSON only: {completed: true|false|"uncertain", score: 0-100, child_message: "...", gems_earned: 0-10}`
    default:
      throw new Error(`Unknown task type: ${taskType}`)
  }
}

function mathPrompt(age, language = 'en') {
  const n = Number(age)
  const lang = language === 'tr' ? 'Turkish' : 'English'
  let difficulty
  if (n <= 6)       difficulty = 'only addition and subtraction up to 10, single-digit numbers only (e.g. "3 + 5 = ?"). No multiplication, division, fractions, or percentages.'
  else if (n === 7) difficulty = 'only addition and subtraction up to 20, single-digit numbers only (e.g. "3 + 5 = ?", "12 - 4 = ?"). No multiplication, division, fractions, or percentages.'
  else if (n === 8) difficulty = 'addition and subtraction up to 50, single and double-digit numbers. No multiplication, division, fractions, or percentages.'
  else if (n <= 10) difficulty = 'multiplication and division, two-digit numbers'
  else              difficulty = 'fractions, percentages, and multi-step problems'
  return `Generate 5 short math questions in ${lang} for a ${n}-year-old child. Difficulty: ${difficulty}. Questions must be direct and concise — no story problems. Return JSON only: {questions: string[]}`
}

function generatePrompt(taskType, age, language = 'en') {
  const n = Number(age) || 7
  const lang = langInstruction(language)
  switch (taskType) {
    case 'writing': return `Generate 5 creative writing prompt topics suitable for a ${n}-year-old child. ${lang} Return JSON only: {questions: string[]}`
    case 'reading': return `Generate 5 reading comprehension questions suitable for a ${n}-year-old child. ${lang} Return JSON only: {questions: string[]}`
    default: return null
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(cleaned)
}

async function callGemini(parts) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { response_mime_type: 'application/json' },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini boş yanıt döndürdü.')
  return parseJSON(text)
}

export async function evaluateTask(file, taskType, age, language = 'en') {
  const prompt = buildEvalPrompt(taskType, age, language)
  const base64 = await fileToBase64(file)
  return callGemini([
    { text: prompt },
    { inline_data: { mime_type: file.type, data: base64 } },
  ])
}

export async function generateTask(childId, taskType, age, language = 'en') {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: submissions } = await supabase
    .from('submissions')
    .select('generated_questions')
    .eq('child_id', childId)
    .eq('task_type', taskType)
    .gte('created_at', sevenDaysAgo)

  const pastQuestions = (submissions || [])
    .flatMap(s => s.generated_questions || [])
    .filter(Boolean)

  const basePrompt = taskType === 'math' ? mathPrompt(age, language) : generatePrompt(taskType, age, language)
  const avoidClause = pastQuestions.length > 0
    ? ` Do not repeat these questions: ${JSON.stringify(pastQuestions)}`
    : ''

  return callGemini([{ text: basePrompt + avoidClause }])
}
