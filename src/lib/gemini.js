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
      return `You are looking at photos of book pages that a ${n}-year-old child just read.
Generate questions ONLY based on what is visible in these page photos.
Do NOT use your knowledge of the book from training data.
Do NOT ask about parts of the book not shown in the photos.
If the photos are not book pages, say so in the feedback field.
If you cannot read the text clearly, ask simpler visual questions about what the child can see in the illustrations.
Base everything strictly on these specific pages shown.
${lang} Return JSON only: {score, feedback, gem_earned, generated_questions} where gem_earned = 30 if score >= 60 else 0, generated_questions is a string array of comprehension questions about ONLY what is visible in these specific pages`
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

export async function evaluateStory(photos, topic, age, language = 'en') {
  const n = Number(age) || 7
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `You are reading a creative story written by a ${n}-year-old child on the topic: "${topic}".
Transcribe and evaluate the handwritten text in the photo(s). Return JSON only, no other text:
{
  "word_count": number,
  "has_profanity": boolean,
  "too_short": boolean,
  "encouragement": "short warm message max 2 sentences in ${lang}",
  "transcribed_text": "full text exactly as written by child",
  "spelling_errors": [{ "wrong": "misspelled word as written", "correct": "correct spelling", "index": 0 }],
  "gems_earned": number
}
Rules:
- too_short: true if word_count < 15
- encouragement: always positive and warm, age-appropriate for a ${n}-year-old, in ${lang}, never mention evaluation or checking
- spelling_errors: only genuine spelling mistakes; do not flag creative or intentional stylistic choices; index = 0-based occurrence if the same wrong word appears multiple times
- has_profanity: true if any profanity or inappropriate language is present
- gems_earned: 10 minimum, up to 50 based on word_count and quality
Be thorough with spelling errors. Common mistakes to catch:
- wrong homophones (off/of, their/there, to/too)
- missing or extra letters (bumms→bumps, weres→were)
- run-together or split words (danc er→dancer, in to→into)
- wrong capitalization mid-sentence
Flag ALL spelling and grammar errors you see.`
  const parts = [{ text: prompt }]
  for (const photo of photos) {
    const base64 = await fileToBase64(photo)
    parts.push({ inline_data: { mime_type: photo.type, data: base64 } })
  }
  return callGemini(parts)
}

export async function checkTitleSpelling(title) {
  const prompt = `Check this story title for spelling errors: "${title}". Return JSON only: { "corrected": "corrected title or same if no errors", "has_errors": true or false }`
  return callGemini([{ text: prompt }])
}

export async function generateStoryIdeas(age, language = 'en') {
  const n = Number(age) || 7
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `Generate 4 creative and imaginative story ideas for a ${n}-year-old child in ${lang}. Each idea should be fun, age-appropriate, and spark curiosity. Return JSON only: { "ideas": [ { "emoji": string, "title": string, "topic": string, "description": string } ] }`
  return callGemini([{ text: prompt }])
}

export async function validateStoryInput(text, age, language = 'en') {
  const n = Number(age) || 7
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `You are a content moderator for a children's educational app. A ${n}-year-old child submitted this story idea: "${text}". Determine if this is appropriate, safe, and suitable for a child's story — no violence, scary content, adult themes, or inappropriate language. Respond in ${lang}. Return JSON only: { "ok": boolean, "reason": string }`
  return callGemini([{ text: prompt }])
}

const MATH_LEVEL_DESC = {
  1: 'Counting, numbers 1-10',
  2: 'Addition up to 10',
  3: 'Subtraction up to 10',
  4: 'Addition up to 20',
  5: 'Subtraction up to 20',
  6: 'Simple word problems (e.g. "You have 5 pencils and give away 3. How many left?")',
  7: 'Addition and subtraction up to 100',
  8: 'Multiplication tables 2, 5, 10',
  9: 'Fractions (1/2, 1/4, 3/4 — express as whole-number answers)',
  10: 'Division (simple, related to multiplication tables)',
  11: 'Geometry basics (shapes, sides, corners)',
  12: 'Measurement (time, money, weight — simple)',
  13: 'Multiplication tables 3, 4, 6, 7, 8, 9',
  14: 'Complex word problems (multi-step)',
  15: 'Fractions and decimals (express as whole-number answers)',
}

export async function generateMathQuestions(age, level, previousQuestions = []) {
  const clampedLevel = Math.min(Math.max(Number(level) || 1, 1), 15)
  const levelDesc = MATH_LEVEL_DESC[clampedLevel] || MATH_LEVEL_DESC[5]
  const avoidClause = previousQuestions.length > 0
    ? `\nDo NOT repeat these questions: ${JSON.stringify(previousQuestions.slice(-10))}`
    : ''
  const prompt = `Generate 5 math questions for a ${age} year old at level ${clampedLevel} (${levelDesc}).
Mix question types: symbolic equations, word problems, and patterns.
Make them fun, relatable and age-appropriate. Use names, animals, food, toys in word problems.
IMPORTANT: All answers must be single positive whole numbers (integers). Design every question so the answer is a positive integer.${avoidClause}
Return JSON only:
{
  "questions": ["5 + 3 = ?", "Sara has 8 apples and eats 3. How many does she have left?", "2, 4, 6, __ what comes next?"],
  "topic": "addition",
  "answers": [8, 5, 8],
  "question_types": ["symbolic", "word", "pattern"]
}`
  return callGemini([{ text: prompt }])
}

export async function evaluateMath(photos, questions, answers, age, level) {
  const clampedLevel = Math.min(Math.max(Number(level) || 1, 1), 15)
  const questionsText = questions.map((q, i) => `Q${i + 1}: ${q} (correct answer: ${answers[i]})`).join('\n')
  const prompt = `Evaluate this ${age}-year-old child's math work photo.
The questions were:
${questionsText}

Be generous and tolerant with handwriting. Try hard to read each digit. When in doubt, assume correct.
Only mark wrong if clearly and unambiguously incorrect.
For word problems, check if the logic and final answer are correct.
For patterns, accept if the child identified the pattern correctly.
Return JSON only:
{
  "results": [
    {"question": "5+3=?", "correct_answer": 8, "child_answer": 8, "correct": true},
    {"question": "Sara has 8 apples...", "correct_answer": 5, "child_answer": 4, "correct": false}
  ],
  "score": 80,
  "accuracy": 80,
  "level_change": "up",
  "new_level": ${clampedLevel},
  "topic": "addition",
  "gemini_notes": "Strong at addition, word problems need practice",
  "next_session": "Try more word problems",
  "encouragement": "warm age-appropriate message max 2 sentences, never mention level number or level change, never say wrong",
  "gems_earned": 30
}
Rules: level_change is "up" if accuracy>=80, "down" if accuracy<40, else "same". new_level = ${clampedLevel} adjusted by level_change (min 1, max 15). gems_earned: 30 if accuracy>=80, 25 if>=60, 15 if>=40, else 10.`
  const parts = [{ text: prompt }]
  for (const photo of photos) {
    const base64 = await fileToBase64(photo)
    parts.push({ inline_data: { mime_type: photo.type, data: base64 } })
  }
  return callGemini(parts)
}

export async function evaluateChore(file, age) {
  const n = Number(age) || 7
  const prompt = `You are evaluating a photo submitted by a ${n}-year-old child as evidence of completing a household chore.
Return JSON only:
{
  "appropriate": boolean,
  "task_description": "brief Turkish description of what was done, e.g. 'Oda toplandı', 'Bulaşıklar yıkandı'",
  "photo_is_recent": true or false or "unknown",
  "quality_score": 0-100,
  "suggested_gems": 10-50,
  "encouragement": "warm Turkish message for child, max 2 sentences, lots of emojis",
  "inappropriate_reason": null or "brief Turkish reason if not appropriate"
}
Rules:
- appropriate: false if the photo contains nothing household-related, is blurry/blank, shows inappropriate content, or is clearly not a chore photo
- task_description: Turkish, brief (3-6 words), describe what was accomplished
- photo_is_recent: "unknown" if you cannot tell; true if it looks recently done; false if clearly old or neglected
- quality_score: 0-100, how well the chore was done; be generous with effort
- suggested_gems: 10-50 based on quality_score; minimum 10 for any effort
- encouragement: warm, positive, age-appropriate Turkish message, never mention the word "evaluation"`
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
