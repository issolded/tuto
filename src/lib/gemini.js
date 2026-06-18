import { supabase } from './supabase'

// ── British National Curriculum ───────────────────────────────────────────────

const BRITISH_CURRICULUM = {
  year1: {
    label: "Year 1", age: [5, 6],
    topics: [
      { id: "y1_place_value", name: "Numbers to 100", description: "Count to and across 100 forwards and backwards. Count, read and write numbers to 100 in numerals. Count in multiples of 2s, 5s and 10s. Identify 1 more and 1 less than a given number.", operations: ["counting","place_value"] },
      { id: "y1_addition", name: "Addition within 20", description: "Read, write and interpret addition statements. Represent and use number bonds within 20. Add one-digit and two-digit numbers to 20.", operations: ["addition"] },
      { id: "y1_subtraction", name: "Subtraction within 20", description: "Represent and use subtraction facts within 20. Subtract one-digit and two-digit numbers within 20. Solve one-step subtraction problems using concrete objects.", operations: ["subtraction"] },
      { id: "y1_fractions", name: "Half and Quarter", description: "Recognise, find and name a half as 1 of 2 equal parts. Recognise, find and name a quarter as 1 of 4 equal parts of an object, shape or quantity.", operations: ["fractions"] },
      { id: "y1_measurement", name: "Measurement", description: "Compare lengths, heights, mass and capacity. Tell the time to the hour and half past. Recognise and know the value of different coins and notes.", operations: ["measurement"] },
      { id: "y1_shapes", name: "Shapes", description: "Recognise and name common 2D shapes (rectangles, circles, triangles) and 3D shapes (cuboids, pyramids, spheres). Describe position, direction and movement.", operations: ["geometry"] }
    ]
  },
  year2: {
    label: "Year 2", age: [6, 7],
    topics: [
      { id: "y2_place_value", name: "Numbers to 100", description: "Count in steps of 2, 3 and 5. Recognise place value of each digit in a two-digit number. Compare and order numbers up to 100 using < > = signs.", operations: ["counting","place_value"] },
      { id: "y2_addition", name: "Addition within 100", description: "Add a two-digit number and ones, a two-digit number and tens, two two-digit numbers, and three one-digit numbers. Use concrete objects and mental methods.", operations: ["addition"] },
      { id: "y2_subtraction", name: "Subtraction within 100", description: "Subtract ones from a two-digit number, tens from a two-digit number, and two two-digit numbers. Recognise inverse relationship with addition.", operations: ["subtraction"] },
      { id: "y2_multiplication", name: "Multiplication: 2, 5 and 10 tables", description: "Recall and use multiplication facts for the 2, 5 and 10 tables. Calculate multiplication statements using × and = signs. Understand multiplication as repeated addition.", operations: ["multiplication"] },
      { id: "y2_division", name: "Division: 2, 5 and 10", description: "Recall and use division facts related to 2, 5 and 10 tables. Calculate division statements using ÷ and = signs. Solve division problems using arrays.", operations: ["division"] },
      { id: "y2_fractions", name: "Fractions: ½ ¼ ¾", description: "Recognise, find, name and write fractions 1/3, 1/4, 2/4 and 3/4 of a length, shape, set of objects or quantity. Write simple fractions such as 1/2 of 6 = 3.", operations: ["fractions"] },
      { id: "y2_money", name: "Money", description: "Recognise and use symbols for pounds and pence. Combine amounts to make a particular value. Solve simple problems involving addition and subtraction of money including giving change.", operations: ["measurement","addition","subtraction"] },
      { id: "y2_time", name: "Time", description: "Tell and write the time to five minutes including quarter past/to the hour. Draw clock hands. Know the number of minutes in an hour and hours in a day.", operations: ["measurement"] },
      { id: "y2_statistics", name: "Data and Charts", description: "Interpret and construct simple pictograms, tally charts, block diagrams and tables. Ask and answer questions about data.", operations: ["statistics"] }
    ]
  },
  year3: {
    label: "Year 3", age: [7, 8],
    topics: [
      { id: "y3_place_value", name: "Numbers to 1000", description: "Count from 0 in multiples of 4, 8, 50 and 100. Recognise place value of each digit in a 3-digit number. Compare and order numbers up to 1,000.", operations: ["counting","place_value"] },
      { id: "y3_addition", name: "Addition up to 3 digits", description: "Add numbers mentally including a 3-digit number and ones, tens, hundreds. Add numbers with up to 3 digits using formal columnar method.", operations: ["addition"] },
      { id: "y3_subtraction", name: "Subtraction up to 3 digits", description: "Subtract numbers mentally including a 3-digit number and ones, tens, hundreds. Subtract numbers with up to 3 digits using formal columnar method.", operations: ["subtraction"] },
      { id: "y3_multiplication", name: "Multiplication: 3, 4 and 8 tables", description: "Recall and use multiplication facts for the 3, 4 and 8 tables. Write and calculate statements for multiplication including 2-digit × 1-digit numbers.", operations: ["multiplication"] },
      { id: "y3_division", name: "Division using known tables", description: "Recall and use division facts for the 3, 4 and 8 tables. Write and calculate division statements. Solve problems involving multiplication and division.", operations: ["division"] },
      { id: "y3_fractions", name: "Fractions and Tenths", description: "Count up and down in tenths. Recognise fractions as parts of a whole. Add and subtract fractions with the same denominator within one whole.", operations: ["fractions"] },
      { id: "y3_measurement", name: "Measurement", description: "Measure and compare lengths (m/cm/mm), mass (kg/g), volume (l/ml). Measure perimeter of simple 2D shapes. Add and subtract amounts of money to give change.", operations: ["measurement"] },
      { id: "y3_time", name: "Time", description: "Tell and write the time from an analogue clock including Roman numerals and 12/24-hour clocks. Estimate and read time to the nearest minute.", operations: ["measurement"] },
      { id: "y3_geometry", name: "Shapes and Angles", description: "Draw 2D shapes and make 3D shapes. Recognise angles as a property of shape. Identify right angles. Identify horizontal, vertical, perpendicular and parallel lines.", operations: ["geometry"] },
      { id: "y3_statistics", name: "Bar Charts and Pictograms", description: "Interpret and present data using bar charts, pictograms and tables. Solve one-step and two-step questions using information in scaled charts.", operations: ["statistics"] }
    ]
  },
  year4: {
    label: "Year 4", age: [8, 9],
    topics: [
      { id: "y4_place_value", name: "Numbers to 10,000", description: "Count in multiples of 6, 7, 9, 25 and 1,000. Count backwards through 0 to include negative numbers. Round to nearest 10, 100 or 1,000.", operations: ["counting","place_value"] },
      { id: "y4_addition", name: "Addition up to 4 digits", description: "Add numbers with up to 4 digits using formal columnar method. Estimate and use inverse operations to check answers. Solve two-step problems.", operations: ["addition"] },
      { id: "y4_subtraction", name: "Subtraction up to 4 digits", description: "Subtract numbers with up to 4 digits using formal columnar method. Estimate and use inverse operations to check answers. Solve two-step problems.", operations: ["subtraction"] },
      { id: "y4_multiplication", name: "All times tables to 12×12", description: "Recall multiplication and division facts for all tables up to 12 × 12. Multiply 2-digit and 3-digit numbers by a 1-digit number using formal layout.", operations: ["multiplication"] },
      { id: "y4_division", name: "Division using all tables", description: "Use place value and known facts to divide mentally. Practise short division with exact answers. Solve problems involving dividing.", operations: ["division"] },
      { id: "y4_fractions", name: "Fractions and Decimals", description: "Recognise and write decimal equivalents of fractions (1/4=0.25, 1/2=0.5, 3/4=0.75). Add and subtract fractions with the same denominator.", operations: ["fractions","decimals"] },
      { id: "y4_measurement", name: "Area and Perimeter", description: "Find the area of rectilinear shapes by counting squares. Calculate the perimeter of rectilinear figures. Convert between different units of measurement.", operations: ["measurement","geometry"] },
      { id: "y4_geometry", name: "Geometry", description: "Compare and classify geometric shapes including quadrilaterals and triangles. Identify lines of symmetry. Describe positions on a 2D grid as coordinates.", operations: ["geometry"] },
      { id: "y4_statistics", name: "Data and Time Graphs", description: "Interpret and present discrete and continuous data using bar charts and time graphs. Solve comparison problems using information presented in charts.", operations: ["statistics"] }
    ]
  },
  year5: {
    label: "Year 5", age: [9, 10],
    topics: [
      { id: "y5_place_value", name: "Numbers to 1,000,000", description: "Read, write, order and compare numbers to at least 1,000,000. Count forwards and backwards with positive and negative whole numbers. Round any number up to 1,000,000.", operations: ["counting","place_value"] },
      { id: "y5_addition", name: "Addition and Subtraction", description: "Add and subtract whole numbers with more than 4 digits using formal written methods. Add and subtract numbers mentally with increasingly large numbers.", operations: ["addition","subtraction"] },
      { id: "y5_multiplication", name: "Multiplication", description: "Multiply numbers up to 4 digits by a 1-digit or 2-digit number using formal written method. Multiply and divide numbers mentally using known facts.", operations: ["multiplication"] },
      { id: "y5_division", name: "Division", description: "Divide numbers up to 4 digits by a 1-digit number using formal written method of short division. Interpret remainders appropriately.", operations: ["division"] },
      { id: "y5_fractions", name: "Fractions", description: "Compare and order fractions. Add and subtract fractions with the same denominator and denominators that are multiples of the same number. Multiply proper fractions by whole numbers.", operations: ["fractions"] },
      { id: "y5_decimals", name: "Decimals and Percentages", description: "Read and write decimal numbers as fractions. Recognise the percent symbol %. Solve problems involving numbers up to 3 decimal places.", operations: ["decimals","fractions"] },
      { id: "y5_geometry", name: "Geometry and Angles", description: "Identify 3D shapes from 2D representations. Know angles are measured in degrees. Draw given angles. Calculate angles on a straight line and around a point.", operations: ["geometry"] },
      { id: "y5_statistics", name: "Statistics", description: "Solve comparison, sum and difference problems using information in a line graph. Complete and interpret information in a table.", operations: ["statistics"] }
    ]
  },
  year6: {
    label: "Year 6", age: [10, 11],
    topics: [
      { id: "y6_place_value", name: "Numbers to 10,000,000", description: "Read, write, order and compare numbers up to 10,000,000. Round any whole number. Use negative numbers in context and calculate intervals across 0.", operations: ["counting","place_value"] },
      { id: "y6_multiplication", name: "Long Multiplication and Division", description: "Multiply multi-digit numbers up to 4 digits by a 2-digit number using long multiplication. Divide numbers up to 4 digits by a 2-digit number using long division.", operations: ["multiplication","division"] },
      { id: "y6_fractions", name: "Fractions, Decimals, Percentages", description: "Use common factors to simplify fractions. Compare and order fractions. Add and subtract fractions with different denominators. Calculate percentages of amounts.", operations: ["fractions","decimals"] },
      { id: "y6_algebra", name: "Algebra", description: "Use simple formulae. Generate and describe linear number sequences. Express missing number problems algebraically. Find pairs of numbers that satisfy equations with two unknowns.", operations: ["algebra"] },
      { id: "y6_ratio", name: "Ratio and Proportion", description: "Solve problems involving relative sizes of two quantities. Solve problems involving similar shapes where the scale factor is known.", operations: ["ratio"] },
      { id: "y6_geometry", name: "Geometry", description: "Find unknown angles in triangles, quadrilaterals and regular polygons. Recognise angles where they meet at a point, on a straight line or are vertically opposite.", operations: ["geometry"] },
      { id: "y6_statistics", name: "Statistics", description: "Interpret and construct pie charts and line graphs. Calculate and interpret the mean as an average.", operations: ["statistics"] }
    ]
  }
}

export function ageToSchoolYear(age) {
  const n = Number(age)
  if (n <= 6) return 'year1'
  if (n === 7) return 'year2'
  if (n === 8) return 'year3'
  if (n === 9) return 'year4'
  if (n === 10) return 'year5'
  return 'year6'
}

export function getTopicsForChild(age, schoolYear = null) {
  const year = schoolYear || ageToSchoolYear(age)
  return BRITISH_CURRICULUM[year]?.topics || []
}

export { BRITISH_CURRICULUM }

// ─────────────────────────────────────────────────────────────────────────────

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

export async function transcribeStory(photos, language = 'en') {
  const prompt = `You are an expert at reading young children's handwriting. First read the WHOLE page and understand the story the child is telling — its meaning and flow. THEN, for each part, infer the word the child most likely INTENDED, using sentence and story context.
Example: "once a pola time" → the child means "once upon a time".
Produce a clean, readable version of the story in correct, age-appropriate words.
- Use context to resolve unclear handwriting; don't transcribe meaningless letter fragments — infer the intended real word.
- IGNORE drawings, speech bubbles, labels, and crossed-out words.
- Read in natural order: top to bottom, left to right. Multiple photos are sequential pages — join them in order.
- NEVER output offensive or nonsense strings.
Return JSON only:
{
  "transcribed_text": string,
  "uncertain_words": [{ "word": string, "index": number }]
}
uncertain_words = the few words you had to GUESS or were least sure about, so we can confirm them with the child. Keep this list short (max 4–5 entries). "index" is the 0-based word position in transcribed_text (split by whitespace).`
  const parts = [{ text: prompt }]
  for (const photo of photos) {
    const base64 = await fileToBase64(photo)
    parts.push({ inline_data: { mime_type: photo.type, data: base64 } })
  }
  return callGemini(parts)
}

export async function evaluateStory(transcribedText, topic, age, language = 'en') {
  const n = Number(age) || 7
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `You are evaluating a creative story written by a ${n}-year-old child on the topic: "${topic}".
The story text is:
"""
${transcribedText}
"""
Return JSON only, no other text:
{
  "word_count": number,
  "has_profanity": boolean,
  "too_short": boolean,
  "encouragement": "short warm message max 2 sentences in ${lang}",
  "spelling_errors": [{ "wrong": "misspelled word as written", "correct": "correct spelling", "index": 0 }],
  "gems_earned": number
}
Rules:
- word_count: count words in the text above
- too_short: true if word_count < 15
- encouragement: always positive and warm, age-appropriate for a ${n}-year-old, in ${lang}, never mention evaluation or checking
- has_profanity: true if any profanity or inappropriate language is present
- gems_earned: 10 minimum, up to 50 based on word_count and quality; independent of spelling
- spelling_errors: for the 11+ path only — flag unambiguous misspellings in the text with a single clear correction. Empty array is fine; when in doubt, omit.`
  return callGemini([{ text: prompt }])
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

export async function generateMathQuestions(age, level, previousQuestions = [], topicId = null) {
  const clampedLevel = Math.min(Math.max(Number(level) || 1, 1), 15)
  const levelDesc = MATH_LEVEL_DESC[clampedLevel] || MATH_LEVEL_DESC[5]
  let topicContext = ''
  if (topicId) {
    const year = ageToSchoolYear(age)
    const topic = BRITISH_CURRICULUM[year]?.topics.find(t => t.id === topicId)
      || Object.values(BRITISH_CURRICULUM).flatMap(y => y.topics).find(t => t.id === topicId)
    if (topic) {
      topicContext = `\nFocus specifically on this curriculum topic: "${topic.name}". ${topic.description}`
    }
  }
  const avoidClause = previousQuestions.length > 0
    ? `\nDo NOT repeat these questions: ${JSON.stringify(previousQuestions.slice(-10))}`
    : ''
  const prompt = `Generate 5 math questions for a ${age} year old at level ${clampedLevel} (${levelDesc}).
Mix question types: symbolic equations, word problems, and patterns.
Make them fun, relatable and age-appropriate. Use names, animals, food, toys in word problems.
IMPORTANT: All answers must be single positive whole numbers (integers). Design every question so the answer is a positive integer.
For pattern questions, only show the number sequence with a blank. Do NOT include descriptions like 'Count by 3s' or 'Skip count by 2s' in the question. Example: '2, 4, 6, 8, __?' not 'Count by 2s: 2, 4, 6, 8, __?'${topicContext}${avoidClause}
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
  "quality_score": 0-100,
  "suggested_gems": 10-50,
  "encouragement": "warm Turkish message for child, max 2 sentences, lots of emojis",
  "inappropriate_reason": null or "brief Turkish reason if not appropriate"
}
Rules:
- appropriate: false if the photo contains nothing household-related, is blurry/blank, shows inappropriate content, or is clearly not a chore photo
- task_description: Turkish, brief (3-6 words), describe what was accomplished
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
