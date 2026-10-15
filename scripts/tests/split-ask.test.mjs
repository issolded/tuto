import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitAsk } from '../../src/lib/splitAsk.js'

test('the question goes on its own line', () => {
  assert.deepEqual(splitAsk('Each ⚽ stands for 4 goals. How many more goals did Theo score than Ada?'),
    ['Each ⚽ stands for 4 goals.', 'How many more goals did Theo score than Ada?'])
  assert.deepEqual(splitAsk('Bir kalem 74 kuruş. Kerem 100 kuruş veriyor. Kaç kuruş para üstü alır?'),
    ['Bir kalem 74 kuruş. Kerem 100 kuruş veriyor.', 'Kaç kuruş para üstü alır?'])
  assert.deepEqual(splitAsk('Es y media. ¿Qué hora acaba de pasar?'), ['Es y media.', '¿Qué hora acaba de pasar?'])
})

test('one sentence, decimals and titles stay whole', () => {
  assert.deepEqual(splitAsk('What is 10 more than 592?'), ['What is 10 more than 592?'])
  assert.deepEqual(splitAsk('Is 2.5 bigger than 2.45?'), ['Is 2.5 bigger than 2.45?'])
  assert.deepEqual(splitAsk('Mr. Ali has 12 eggs. How many boxes of 6?'), ['Mr. Ali has 12 eggs.', 'How many boxes of 6?'])
  assert.deepEqual(splitAsk('Count on in 8s. What comes next? 16, 24, …'), ['Count on in 8s. What comes next? 16, 24, …'])
})
