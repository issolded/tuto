import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProblem } from '../../src/lib/mathTemplates.js'
import { sameKindProblem, questionKind, operationSigns } from '../../src/lib/reviewQuestions.js'
import { templateTopicFor, startingLevelForAge, clampLevelToAge } from '../../src/lib/mathCurriculum.js'
import { BRITISH_CURRICULUM, ageToSchoolYear } from '../../src/lib/gemini.js'

// A review asks the same KIND of question again — never a different kind of the same topic.
test('every question a review draws is the same kind as the one it follows, across ages 7-13', () => {
  let total = 0
  const failed = []
  for (const age of [7, 8, 9, 10, 11, 12, 13]) {
    const level = clampLevelToAge(startingLevelForAge(age), age)
    for (const t of BRITISH_CURRICULUM[ageToSchoolYear(age)].topics) {
      const topic = templateTopicFor(t)
      if (!topic) continue
      for (let i = 0; i < 40; i++) {
        const src = generateProblem(topic, level, null, 'en')
        const used = new Set([src.operandKey])
        const p = sameKindProblem(src, { topic, usedOperands: used, language: 'en' })
        total++
        // Never a different kind. A kind that cannot be drawn at all (a rare item combination) is a null, and
        // the review leaves that question out.
        if (p) assert.equal(questionKind(p.operandKey), questionKind(src.operandKey))
        else failed.push(`${age}/${topic}/${src.operandKey}`)
      }
    }
  }
  assert.ok(total > 1500)
  assert.ok(failed.length <= total * 0.003, `${failed.length}/${total} could not be drawn again: ${failed.slice(0, 5)}`)
})

test('a kind whose sentence never changes still comes back (the two-times question differs in its picture)', () => {
  let n = 0
  for (let i = 0; i < 3000 && n < 30; i++) {
    const src = generateProblem('time', 10, null, 'en')
    if (!src.operandKey.startsWith('tbetween')) continue
    n++
    const p = sameKindProblem(src, { usedOperands: new Set([src.operandKey]), language: 'en' })
    assert.ok(p && p.operandKey.startsWith('tbetween'), 'not the same kind')
    assert.notEqual(p.operandKey, src.operandKey)
  }
  assert.ok(n >= 30)
})

// The operation is part of the kind. Hand-written keys, so this does not lean on the function under test
// to say what the right label is: a fraction product and a fraction quotient are different skills.
test('keys that differ only in the operation are different kinds', () => {
  assert.notEqual(questionKind('fdp:o:5/9×1/6'), questionKind('fdp:o:2 7/8÷4 4/5'))
  assert.notEqual(questionKind('fdp:o:1/2+1/3'), questionKind('fdp:o:3/4−1/8'))
  assert.notEqual(questionKind('fdp:o:1/2+1/3'), questionKind('fdp:o:1/2×1/3'))
  // The same operation with other numbers is the same kind.
  assert.equal(questionKind('fdp:o:5/9×1/6'), questionKind('fdp:o:3/7×2/5'))
  // A minus sign on a number is not an operation.
  assert.equal(questionKind('neg:-3'), questionKind('neg:-8'))
})

test('operation signs: a subtraction and a square are not the same operation; a negative number is not a subtraction', () => {
  assert.notEqual(operationSigns('(−6) − (−16) = ?'), operationSigns('(−2)² = ?'))
  assert.equal(operationSigns('(−6) − (−16) = ?'), operationSigns('(−12) − 5 = ?'))
  assert.equal(operationSigns('If a = 4 and b = −5, what is 6a + 4b + 1?'), operationSigns('If a = 7 and b = 5, what is 5a + 3b + 11?'))
  assert.notEqual(operationSigns('5/9 × 1/6'), operationSigns('2 7/8 ÷ 4 4/5'))
})

// An independent oracle: the operation signs the CHILD SEES in the question text. A review question must
// show the same ones as the question it follows, whatever the key says.
test('a review question has the same operation signs on screen as the question it follows', () => {
  // × and ÷ wherever they stand; + and − only as an operation between two things, spaced ("5 + 3"), not as
  // the sign of a number ("b = −5").
  const signs = (t) => [...new Set([...(String(t).match(/[×÷]/g) || []), ...(String(t).match(/(?<=\S) ([+−]) (?=\S)/g) || []).map(x => x.trim())])].sort().join('')
  let total = 0, differ = 0
  const sample = []
  for (const age of [9, 10, 11, 12, 13]) {
    const level = clampLevelToAge(startingLevelForAge(age), age)
    for (const t of BRITISH_CURRICULUM[ageToSchoolYear(age)].topics) {
      const topic = templateTopicFor(t)
      if (!topic) continue
      for (let i = 0; i < 60; i++) {
        const src = generateProblem(topic, level, null, 'en')
        if (!signs(src.question_text)) continue
        const p = sameKindProblem(src, { topic, usedOperands: new Set([src.operandKey]), language: 'en' })
        if (!p) continue
        total++
        if (signs(p.question_text) !== signs(src.question_text)) { differ++; if (sample.length < 5) sample.push(`${src.question_text}  ->  ${p.question_text}`) }
      }
    }
  }
  assert.ok(total > 300, `only ${total} questions with signs`)
  assert.ok(differ <= total * 0.01, `${differ}/${total} changed operation: ${sample.join(' | ')}`)
})
