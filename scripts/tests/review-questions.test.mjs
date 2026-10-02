import test from 'node:test'
import assert from 'node:assert/strict'
import { generateProblem } from '../../src/lib/mathTemplates.js'
import { sameKindProblem, questionKind } from '../../src/lib/reviewQuestions.js'
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
