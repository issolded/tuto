// Every recording the English trial set (docs/ENGLISH-TRIAL-SET.md) needs: the listening items (A), and
// the spoken feedback the reading and spelling items give after a wrong answer (B01/02, CA01–03, D01/02).
// Reading items (B03+, C, E) are read, not heard; reading their text aloud is a separate support.
//
// kind: word | sentence | dialogue | instruction. A dialogue is a list of [speaker, line]; each line is
// made on its own with that speaker's voice and the lines are joined with a short pause, so that every
// line can be checked on its own.

export const VOICES = {
  // Chosen 2026-10-16 by a blind accent check (two runs each, see docs/ENGLISH-AUDIO.md). Puck reads
  // American even when asked for en-GB, so the British male is Charon; for American English, Puck is right.
  uk: { female: 'Leda', male: 'Charon' },
  us: { female: 'Leda', male: 'Puck' },
}
export const SPEAKERS = { Mia: 'female', Ben: 'male', Leo: 'male', Kim: 'female' }

export const CLIPS = [
  // words — A01/A02 prompts, and the feedback of B01/B02 and D01/D02
  { id: 'w-dog', kind: 'word', text: 'dog', items: ['A01', 'B01'] },
  { id: 'w-apple', kind: 'word', text: 'apple', items: ['A02', 'B02'] },
  { id: 'w-sun', kind: 'word', text: 'sun', items: ['D01'] },
  { id: 'w-fish', kind: 'word', text: 'fish', items: ['D02'] },
  // sentences — A03/A04 prompts, and the feedback of CA01–CA03
  { id: 's-ball-under-chair', kind: 'sentence', text: 'The ball is under the chair.', items: ['A03'] },
  { id: 's-two-cats-sleeping', kind: 'sentence', text: 'Two cats are sleeping.', items: ['A04'] },
  { id: 's-cat-on-bed', kind: 'sentence', text: 'The cat is on the bed.', items: ['CA01'] },
  { id: 's-box-open', kind: 'sentence', text: 'The box is open.', items: ['CA02'] },
  { id: 's-window-not-open', kind: 'sentence', text: 'The window is not open. It is closed.', items: ['CA03'] },
  // A05
  { id: 'd-a05', kind: 'dialogue', items: ['A05'], lines: [
    ['Mia', 'Shall we draw outside? I have paper and pencils in my bag.'],
    ['Ben', 'Look at those clouds. It is starting to rain, and the paper will get wet out here.'],
    ['Mia', 'There is a table under that roof. We can sit there.'],
    ['Ben', "Good idea. Let's take our things over."],
  ] },
  { id: 'q-a05', kind: 'sentence', text: 'Why do they choose the table?', items: ['A05'] },
  { id: 'o-a05-1', kind: 'sentence', text: 'To eat lunch.', items: ['A05'] },
  { id: 'o-a05-2', kind: 'sentence', text: 'To keep the paper dry.', items: ['A05'] },
  { id: 'o-a05-3', kind: 'sentence', text: 'To watch the rain.', items: ['A05'] },
  { id: 'f-a05', kind: 'sentence', text: 'To keep the paper dry. It is raining, so they choose a table under a roof.', items: ['A05'] },
  // A06
  { id: 'd-a06', kind: 'dialogue', items: ['A06'], lines: [
    ['Leo', 'We are nearly at the library. Have you got the book we need to take back?'],
    ['Kim', 'I thought you had it. I only put my coat in this bag.'],
    ['Leo', 'Oh, I left the book on the kitchen table.'],
    ['Kim', "Let's go back and get it. We still have time."],
  ] },
  { id: 'q-a06', kind: 'sentence', text: 'Why do they go back?', items: ['A06'] },
  { id: 'o-a06-1', kind: 'sentence', text: 'To get a book.', items: ['A06'] },
  { id: 'o-a06-2', kind: 'sentence', text: 'To find a coat.', items: ['A06'] },
  { id: 'o-a06-3', kind: 'sentence', text: 'To close a window.', items: ['A06'] },
  { id: 'f-a06', kind: 'sentence', text: 'To get a book. Leo left it on the kitchen table.', items: ['A06'] },
  // instructions, heard in the listening area (A has no written text) and in the worked example
  { id: 'i-listen-picture', kind: 'instruction', text: 'Listen and choose the picture.', items: ['A01', 'A02', 'A03', 'A04'] },
  { id: 'i-listen-answer', kind: 'instruction', text: 'Listen to the children. Then choose the answer.', items: ['A05', 'A06'] },
  { id: 'i-look', kind: 'instruction', text: 'Look and listen.', items: ['example'] },
  { id: 'i-your-turn', kind: 'instruction', text: 'Now you try.', items: ['example'] },
]
