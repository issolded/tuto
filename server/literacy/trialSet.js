// The 36 items of docs/ENGLISH-TRIAL-SET.md (revision 2), as data the trial lab plays. The document is
// the editorial source: what each item measures, what else a wrong answer could mean, why it is built
// this way. This file is only what the screen needs. Everything the child sees or hears is English.
//
// Answer keys are here because the lab is a reviewer tool, never a child screen (ENGLISH-LITERACY-
// ARCHITECTURE.md: a child screen gets items from the server without the key).
//
// prompt.audio / feedback.audio: clip ids in scripts/english-audio/clips.mjs (src/lib/literacy/audioManifest.generated.json)
// picture.object: a Noto emoji drawing (artManifest.objects); picture.scene: a scene drawing (artManifest.scenes)
// mode: 'listen-picture' | 'listen-answer' | 'read-picture' | 'read-choice' | 'build' | 'order'

const pic = id => ({ object: id })
const scene = id => ({ scene: id })

export const TRIAL_REVISION = 'trial-2'

export const PASSAGES = {
  P1: { title: 'Mia and the ball', text: ['Mia has a ball. She puts it in a box. Then she closes the box.'] },
  P2: { title: 'A paper bridge', text: ['Ben and Sara wanted to make a bridge for a toy car. They put a sheet of paper between two books. When Ben put the car in the middle, the paper bent and the car fell. Sara folded the paper several times and put it back between the books. This time, the car stayed on the bridge. They tried a second car as well. The folded paper held both cars.'] },
  P3: { title: 'The book table', text: [
    'Every Friday, the school library put a small table near its door. Children could leave a book they no longer wanted and choose a different one to take home. At first, only a few children stopped. Most walked past without looking at the books.',
    'Noor liked the idea, but she noticed a problem. The books were stacked in tall piles, so only the top cover of each pile could be seen. A handwritten sign said “Book Table”, but it did not explain that children could take a book for free. One child asked how much a story cost. Another thought the table was only for returning library books.',
    'Noor asked the librarian if she could try a new arrangement for one Friday. She placed the books upright so their covers faced the door. She also made a sign: “Bring a book if you can. Choose one to keep. No money needed.” The librarian agreed to keep the table in the same place and open it at the usual time.',
    'That afternoon, more children stopped at the table than the week before. Some read the sign before choosing a book. Others pointed to a cover and called a friend over. By the end of the afternoon, many books had found new readers.',
    'Noor was pleased, but the librarian suggested trying the arrangement again. “Perhaps more children happened to come to the library today,” she said. “Let\'s watch what happens over the next few Fridays.” Noor kept her sign and made a simple chart. Each week, she would record how many children stopped and how many books they took. She wanted to know whether the change continued to help.',
  ] },
}

const choice = (...texts) => texts.map((t, i) => ({ id: `o${i + 1}`, text: t }))
const pics = (...ps) => ps.map(([id, p]) => ({ id, picture: p }))

export const TRIAL_ITEMS = [
  // ── A: listening ────────────────────────────────────────────────────────────────────────────
  { id: 'A01', area: 'A', step: 'A1', mode: 'listen-picture', instruction: { audio: 'i-listen-picture' }, prompt: { audio: 'w-dog' },
    options: pics(['cat', pic('cat')], ['dog', pic('dog')], ['rabbit', pic('rabbit')]), key: 'dog', feedback: { audio: 'w-dog' } },
  { id: 'A02', area: 'A', step: 'A1', mode: 'listen-picture', instruction: { audio: 'i-listen-picture' }, prompt: { audio: 'w-apple' },
    options: pics(['banana', pic('banana')], ['pear', pic('pear')], ['apple', pic('apple')]), key: 'apple', feedback: { audio: 'w-apple' } },
  { id: 'A03', area: 'A', step: 'A3', mode: 'listen-picture', instruction: { audio: 'i-listen-picture' }, prompt: { audio: 's-ball-under-chair' },
    options: pics(['on', scene('ball-on-chair')], ['under', scene('ball-under-chair')], ['next', scene('ball-next-to-chair')]), key: 'under', feedback: { audio: 's-ball-under-chair' } },
  { id: 'A04', area: 'A', step: 'A3', mode: 'listen-picture', instruction: { audio: 'i-listen-picture' }, prompt: { audio: 's-two-cats-sleeping' },
    options: pics(['two-sleep', scene('two-cats-sleeping')], ['one-sleep', scene('one-cat-sleeping')], ['two-run', scene('two-cats-running')]), key: 'two-sleep', feedback: { audio: 's-two-cats-sleeping' } },
  { id: 'A05', area: 'A', step: 'A5', mode: 'listen-answer', instruction: { audio: 'i-listen-choose' }, prompt: { audio: 'd-a05', question: 'q-a05' },
    options: [{ id: 'o1', audio: 'o-a05-1' }, { id: 'o2', audio: 'o-a05-2' }, { id: 'o3', audio: 'o-a05-3' }], key: 'o2', feedback: { audio: 'f-a05' } },
  { id: 'A06', area: 'A', step: 'A5', mode: 'listen-answer', instruction: { audio: 'i-listen-choose' }, prompt: { audio: 'd-a06', question: 'q-a06' },
    options: [{ id: 'o1', audio: 'o-a06-1' }, { id: 'o2', audio: 'o-a06-2' }, { id: 'o3', audio: 'o-a06-3' }], key: 'o1', feedback: { audio: 'f-a06' } },

  // ── B: reading words ────────────────────────────────────────────────────────────────────────
  { id: 'B01', area: 'B', step: 'B1', mode: 'read-picture', instruction: { text: 'Read the word. Choose the picture.' }, prompt: { text: 'dog' },
    options: pics(['dog', pic('dog')], ['rabbit', pic('rabbit')], ['cat', pic('cat')]), key: 'dog', feedback: { audio: 'w-dog' } },
  { id: 'B02', area: 'B', step: 'B1', mode: 'read-picture', instruction: { text: 'Read the word. Choose the picture.' }, prompt: { text: 'apple' },
    options: pics(['pear', pic('pear')], ['apple', pic('apple')], ['banana', pic('banana')]), key: 'apple', feedback: { audio: 'w-apple' } },
  { id: 'B03', area: 'B', step: 'B3', mode: 'read-choice', prompt: { text: 'What is the opposite of hot?' },
    options: choice('cold', 'big', 'fast'), key: 'o1', feedback: { text: 'Cold is the opposite of hot.' } },
  { id: 'B04', area: 'B', step: 'B3', mode: 'read-choice', prompt: { context: 'The child picked up a bag.', text: 'Which word means the same as child here?' },
    options: choice('kid', 'parent', 'teacher'), key: 'o1', feedback: { text: 'Kid means child here.' } },
  { id: 'B05', area: 'B', step: 'B6', mode: 'read-choice', prompt: { context: 'Eva was reluctant to try the new game.', text: 'What does reluctant mean here?' },
    options: choice('not wanting to try', 'ready to start at once', 'unable to see the game'), key: 'o1', feedback: { text: 'Reluctant means not wanting to do something.' } },
  { id: 'B06', area: 'B', step: 'B6', mode: 'read-choice', prompt: { context: 'We had sufficient paper for everyone.', text: 'What does sufficient mean here?' },
    options: choice('more than we could carry', 'enough for what we needed', 'less than we needed'), key: 'o2', feedback: { text: 'Sufficient means enough for what is needed.' } },

  // ── Ca: understanding a sentence ────────────────────────────────────────────────────────────
  { id: 'CA01', area: 'Ca', step: 'Ca1', mode: 'read-picture', instruction: { text: 'Read. Choose the picture.' }, prompt: { text: 'The cat is on the bed.' },
    options: pics(['under', scene('cat-under-bed')], ['next', scene('cat-next-to-bed')], ['on', scene('cat-on-bed')]), key: 'on', feedback: { audio: 's-cat-on-bed' } },
  { id: 'CA02', area: 'Ca', step: 'Ca1', mode: 'read-picture', instruction: { text: 'Read. Choose the picture.' }, prompt: { text: 'The box is open.' },
    options: pics(['box-closed', scene('box-closed')], ['box-open', scene('box-open')], ['bag-open', scene('bag-open')]), key: 'box-open', feedback: { audio: 's-box-open' } },
  { id: 'CA03', area: 'Ca', step: 'Ca3', mode: 'read-picture', instruction: { text: 'Read. Choose the picture.' }, prompt: { text: 'The window is not open.' },
    options: pics(['window-open', scene('window-open')], ['door-open', scene('door-open')], ['window-closed', scene('window-closed')]), key: 'window-closed', feedback: { audio: 's-window-not-open' } },
  { id: 'CA04', area: 'Ca', step: 'Ca3', mode: 'read-choice', prompt: { context: 'Yesterday the cat was outside. Today it is in the house.', text: 'Where is the cat today?' },
    options: choice('in the house', 'outside', 'the text does not say'), key: 'o1', feedback: { text: 'In the house. The text says: Today it is in the house.' } },
  { id: 'CA05', area: 'Ca', step: 'Ca4', mode: 'read-choice', prompt: { context: 'Before Mia went to school, she fed the cat. After school, she read a book.', text: 'What happened first?' },
    options: choice('read a book', 'went to school', 'fed the cat'), key: 'o3', feedback: { text: 'She fed the cat first, before she went to school.' } },
  { id: 'CA06', area: 'Ca', step: 'Ca4', mode: 'read-choice', prompt: { context: 'After Ben washed his hands, he ate an apple. Then he drank some water.', text: 'What happened first?' },
    options: choice('ate an apple', 'washed his hands', 'drank some water'), key: 'o2', feedback: { text: 'He washed his hands first. Then he ate an apple and drank some water.' } },

  // ── Cd: the right form ──────────────────────────────────────────────────────────────────────
  { id: 'CD01', area: 'Cd', step: 'Cd1', mode: 'read-choice', prompt: { text: 'The cat ___ asleep.' }, options: choice('are', 'am', 'is'), key: 'o3',
    feedback: { text: 'The cat is asleep. Use is with the cat.' } },
  { id: 'CD02', area: 'Cd', step: 'Cd1', mode: 'read-choice', prompt: { text: 'One dog. Two ___.' }, options: choice('dogs', "dog's", 'dog'), key: 'o1',
    feedback: { text: 'Two dogs. Add s for more than one dog. No apostrophe is needed.' } },
  { id: 'CD03', area: 'Cd', step: 'Cd3', mode: 'read-choice', prompt: { text: 'Yesterday we ___ to the park.' }, options: choice('goed', 'went', 'go'), key: 'o2',
    feedback: { text: 'Yesterday we went to the park. Went is the past form of go.' } },
  { id: 'CD04', area: 'Cd', step: 'Cd3', mode: 'read-choice', prompt: { text: 'The dogs ___ running.' }, options: choice('am', 'is', 'are'), key: 'o3',
    feedback: { text: 'The dogs are running. Use are with the dogs.' } },
  { id: 'CD05', area: 'Cd', step: 'Cd6', mode: 'read-choice', prompt: { text: 'The cake ___ by my aunt yesterday.' }, options: choice('made', 'was made', 'is make'), key: 'o2',
    feedback: { text: 'The cake was made by my aunt yesterday. My aunt made the cake.' } },
  { id: 'CD06', area: 'Cd', step: 'Cd6', mode: 'read-choice', prompt: { text: 'The girl ___ lives next door is my friend.' }, options: choice('which', 'what', 'who'), key: 'o3',
    feedback: { text: 'The girl who lives next door is my friend. Who refers to the girl.' } },

  // ── D: spelling ─────────────────────────────────────────────────────────────────────────────
  { id: 'D01', area: 'D', step: 'D1', mode: 'build', instruction: { text: 'Build the word.' }, prompt: { picture: pic('sun') },
    letters: ['n', 's', 'u'], answer: 'sun', feedback: { audio: 'w-sun' } },
  { id: 'D02', area: 'D', step: 'D1', mode: 'build', instruction: { text: 'Build the word.' }, prompt: { picture: pic('fish') },
    letters: ['h', 'f', 's', 'i'], answer: 'fish', feedback: { audio: 'w-fish' } },
  { id: 'D03', area: 'D', step: 'D3', mode: 'read-choice', prompt: { text: 'One baby. Two ___.' }, options: choice('babys', 'babyes', 'babies'), key: 'o3',
    feedback: { text: 'Babies. Change the y in baby to ies.' } },
  { id: 'D04', area: 'D', step: 'D3', mode: 'read-choice', prompt: { text: 'One toy. Two ___.' }, options: choice('toies', 'toys', 'toyies'), key: 'o2',
    feedback: { text: 'Toys. Add s to toy.' } },
  { id: 'D05', area: 'D', step: 'D6', mode: 'read-choice', prompt: { text: 'Choose the correct spelling.' }, options: choice('necessary', 'neccessary', 'necesary'), key: 'o1',
    feedback: { text: 'Necessary has one c and two s letters.' } },
  { id: 'D06', area: 'D', step: 'D6', mode: 'read-choice', prompt: { text: 'Choose the correct spelling.' }, options: choice('reccomend', 'recomend', 'recommend'), key: 'o3',
    feedback: { text: 'Recommend has one c and two m letters.' } },

  // ── E: reading a text ───────────────────────────────────────────────────────────────────────
  { id: 'E01', area: 'E', step: 'E1', mode: 'read-choice', passage: 'P1', prompt: { text: 'Where is the ball?' }, options: choice('in a box', 'on a bed', 'under a chair'), key: 'o1',
    feedback: { text: 'In a box. The text says: She puts it in a box.' } },
  { id: 'E02', area: 'E', step: 'E1', mode: 'read-choice', passage: 'P1', prompt: { text: 'What does Mia do after she puts the ball in the box?' },
    options: choice('opens the box', 'closes the box', 'takes out the ball'), key: 'o2', feedback: { text: 'She closes the box. The text says: Then she closes the box.' } },
  { id: 'E03', area: 'E', step: 'E3', mode: 'read-choice', passage: 'P2', prompt: { text: 'Why did the car fall on the first try?' },
    options: choice('The books fell.', 'The paper bent.', 'Sara pushed the car.'), key: 'o2', feedback: { text: 'The paper bent. The text says: the paper bent and the car fell.' } },
  { id: 'E04', area: 'E', step: 'E3', mode: 'order', passage: 'P2', prompt: { text: 'Put the events in order.' },
    cards: [{ id: 'c1', text: 'The folded paper held two cars.' }, { id: 'c2', text: 'The first car fell.' }, { id: 'c3', text: 'Sara folded the paper.' }],
    order: ['c2', 'c3', 'c1'], feedback: { text: 'The first car fell. Then Sara folded the paper. Finally, the folded paper held two cars.' } },
  { id: 'E05', area: 'E', step: 'E5', mode: 'read-choice', passage: 'P3', prompt: { text: 'What was missing from the first sign that explains why a child asked about the price?' },
    options: choice('It did not say the books were free.', 'It gave the wrong opening time.', 'It said all the books were sold.'), key: 'o1',
    feedback: { text: 'The sign did not say the books were free. A child asked how much a story cost.' } },
  { id: 'E06', area: 'E', step: 'E5', mode: 'read-choice', passage: 'P3', prompt: { text: 'Why does the librarian suggest watching for a few more Fridays?' },
    options: choice('To check whether the change keeps helping.', 'To wait until every child brings a book.', 'To decide how much each book should cost.'), key: 'o1',
    feedback: { text: 'To check whether the change keeps helping. More children might simply have visited that day.' } },
]

export const AREAS = { A: 'Listening', B: 'Reading words', Ca: 'Understanding sentences', Cd: 'The right form', D: 'Spelling', E: 'Reading a text' }
