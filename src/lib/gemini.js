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

export { BRITISH_CURRICULUM }

// ─────────────────────────────────────────────────────────────────────────────

// Gemini calls go through the backend now — the API key must never ship in
// the client bundle (it did before, got scraped and flagged as leaked by
// Google, which broke Gemini access everywhere, frontend and backend alike).
const SERVER = import.meta.env.VITE_SERVER_URL || 'https://tuto-production-d1db.up.railway.app'
const API_URL = `${SERVER}/api/gemini/generate`

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// gemini-3.5-flash intermittently ends a response badly: it appends stray prose after the
// object, or stops without emitting the final closing brackets. Both made JSON.parse throw,
// and every caller here treats that as total failure — a maths session bounced the child
// back to the mode picker with no questions and no explanation. Measured ~7% of maths
// generations and ~25% of the longer story-transcription ones, so this is routine, not rare.
//
// The content itself is intact in these responses; only the tail is wrong. So walk the
// object tracking bracket depth (ignoring brackets inside strings), and either stop at the
// point it balances — discarding trailing junk — or close whatever is still open.
function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through to repair
  }

  const start = cleaned.indexOf('{')
  if (start === -1) throw new Error('Gemini yanıtında JSON nesnesi yok.')

  const open = []
  let inString = false, escaped = false
  let lastClose = -1, pendingAtLastClose = null

  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue

    if (c === '{') open.push('}')
    else if (c === '[') open.push(']')
    else if (c === '}' || c === ']') {
      open.pop()
      lastClose = i
      pendingAtLastClose = [...open]
      // Balanced here: anything after this is trailing junk.
      if (open.length === 0) return JSON.parse(cleaned.slice(start, i + 1))
    }
  }

  // Never balanced — cut the dangling tail and close what is still open. A value that was
  // truncated mid-way is dropped with it; callers already default missing fields.
  if (lastClose === -1) throw new Error('Gemini JSON yanıtı onarılamadı.')
  return JSON.parse(cleaned.slice(start, lastClose + 1) + pendingAtLastClose.reverse().join(''))
}

// The proxy needs to know WHICH child is calling: it only relays for a real
// child id, and rate limits per child. The child has no Supabase session, so
// localStorage('child') — set at PIN login — is the only identity we have.
export function currentChildId() {
  try { return JSON.parse(localStorage.getItem('child') || 'null')?.id || null }
  catch { return null }
}

async function callGemini(parts) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parts,
      childId: currentChildId(),
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

// The language matters here or the check does harm: a Turkish title run through an English
// spell check comes back "corrected" into nonsense.
export async function checkTitleSpelling(title, language = 'en') {
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `Check this ${lang} story title for spelling errors: "${title}". The title is written in ${lang} — judge it as ${lang}, and if it is already correct return it unchanged. Return JSON only: { "corrected": "corrected title or same if no errors", "has_errors": true or false }`
  return callGemini([{ text: prompt }])
}

export async function generateStoryIdeas(age, language = 'en') {
  const n = Number(age) || 7
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const prompt = `Generate 4 creative and imaginative story ideas for a ${n}-year-old child in ${lang}. Each idea should be fun, age-appropriate, and spark curiosity. Return JSON only: { "ideas": [ { "emoji": string, "title": string, "topic": string, "description": string } ] }`
  return callGemini([{ text: prompt }])
}

// Questions for a named set of curriculum topics — one per topic, in the order given.
//
// The generator this replaced asked for five questions at "level N (Subtraction up to 20)",
// which is why a ten-year-old's whole session was subtraction: the prompt could not describe
// anything else. This one is handed the actual curriculum entries — name and the description
// written for exactly this purpose — and returns a question per topic. Everything the older
// prompt learned the hard way (metric only, no country-specific money, × and ÷ rather than
// * and /, no general knowledge the answer hinges on) is kept, because those were all real
// faults found in real output.
export async function generateCurriculumQuestions(age, level, topics, previousQuestions = [], language = 'en') {
  // Translating the interface is not enough on its own: a child who reads only Turkish cannot
  // answer "A baker has 1 kg of flour" however Turkish the buttons around it are. The topic
  // descriptions stay in English — they are curriculum text written for the model, not for the
  // child — and only the questions themselves change language.
  const lang = language === 'tr' ? 'Turkish' : 'English'
  const list = topics.map((t, i) => `Q${i + 1} — "${t.name}": ${t.description}`).join('\n')
  const avoidClause = previousQuestions.length > 0
    ? `\nDo NOT repeat or lightly reword these recent questions: ${JSON.stringify(previousQuestions.slice(-20))}`
    : ''
  // The dial runs 1–15 across the whole app; the child's year already fixes the syllabus, so
  // this only says where inside it to sit.
  const pitch = level <= 4 ? 'the easier end of this topic'
    : level >= 12 ? 'the harder end of this topic, but still on the topic'
    : 'the middle of this topic'

  const prompt = `Generate ${topics.length} maths questions for a ${age} year old following the English National Curriculum.
Write every question, and every hint step, in ${lang}. Use ${lang} number words and ${lang} names
where a name is needed. The JSON keys stay exactly as shown below, in English.
Each question covers a DIFFERENT topic, in this exact order:
${list}

Pitch each question at ${pitch}.
Make them fun and relatable — use names, animals, food, space, sport. Vary the framing: some plain
calculations, some word problems.
Write operators the way a child is taught them: × and ÷, never * or /.

FORMAT — the question is shown to the child as ONE run of plain text, so:
- Write it as flowing prose that would still make sense read aloud.
- NEVER a table, and never the pipe character. NEVER markdown, bullet points, numbered lists,
  headings or line breaks. A table collapses into an unreadable row of numbers.
- Data for a statistics or graph question goes INTO the sentence: "The Strikers scored 4, 6, 3
  and 5 goals over four weeks, and the Defenders scored 2, 5, 1 and 4." Never "Team | Week 1 |
  Week 2".
- Keep it under 300 characters.

ANSWER RULES — these are strict, because the child types the answer on a number pad:
- Every answer must be a single positive number: either a whole number, or a decimal with at
  most 2 decimal places. Write decimals with a point, e.g. 3.75.
- NEVER an answer that is a fraction (3/4), a ratio (2:3), a range, a list, a letter, or a word.
- If a topic is naturally about fractions, ratio or algebra, pose it so the ANSWER is still a
  single number — "3/10 of 40 kg" (answer 12), "share 20 in the ratio 2:3, how much is the
  larger share" (answer 12), "if 4n = 28, what is n" (answer 7).
- Never put units inside the answer. Units belong in the question.

FAIRNESS RULES:
- No country-specific money (dime, nickel, penny, quarter, cent, dollar, pound). Name a neutral
  amount instead, or avoid money.
- Metric units only (grams, kilograms, centimetres, metres, litres). Never pounds, ounces,
  inches, feet.
- Do not hinge an answer on a fact the child must simply know. Sides and corners of common
  shapes ARE fine, and the hint may supply the fact.
- PLAUSIBILITY: When placing a large number in a real-world context, the number must fit that
  context. A stadium holds at most 100,000 people — 637,000 fans is impossible and confusing.
  Good contexts for 6-digit numbers: city population (200,000–900,000), a country's annual
  ticket sales, total distance driven in a year. Country populations or distances between
  continents fit 7-digit numbers. Never assign a crowd size, room capacity, or small-object
  count that defies common sense.${avoidClause}

Also return "hint_steps": one entry per question, 1-2 SHORT steps that walk the child toward the
answer WITHOUT ever stating it. Where a question needs a fact, the first step supplies it.

Return JSON only:
{
  "questions": ["..."],
  "answers": [12, 3.75],
  "answer_formats": ["integer", "decimal"],
  "hint_steps": [["...", "..."], ["...", "..."]]
}`
  return callGemini([{ text: prompt }])
}

export async function evaluateMath(photos, questions, answers, age, level, language = 'en') {
  // The child reads `encouragement`; the parent reads `gemini_notes` and `next_session` in
  // their Telegram message. Both follow the child's language — in a family where the two
  // differ the note arrives in the child's language, which is the lesser oddity of the two
  // and the one that keeps the child's own screen right.
  const lang = language === 'tr' ? 'Turkish' : 'English'
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
  "_language_note": "write encouragement, gemini_notes and next_session in ${lang}; leave every JSON key in English",
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

