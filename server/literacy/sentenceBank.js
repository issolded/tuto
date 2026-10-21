// Written items for ladder steps that had (almost) nothing: Ca2, Ca3, Ca4, Cd6, E1 (docs/ENGLISH-SKILL-LADDERS.md).
// Written for Tuto (2026-10-18, Claude); no book text. All read-choice: context (optional) + question + three
// options, ANSWER FIRST in the source; the order a child sees is set from the id (balanced), never by hand.
//
//   Ca2  question -> the reply that fits it (the wrong ones answer a different question)
//   Ca3  negation and time: two short sentences, one fact changed or denied
//   Ca4  order of events with before / after / then
//   Cd6  passive and relative pronouns (UK Year 5–6)
//   E1   two or three sentences, one explicit detail
// Checked by scripts/english-ladder/check-bank.mjs: Starters + Movers words (Cd6 also Flyers), the safety lists,
// no UK/US words, and a blind solver (guessed without the context = rejected; missed with it = rejected).

export const SENTENCE_REVISION = 'sentences-1'

const SOURCE = [
  // ── Ca2: question and answer ───────────────────────────────────────────────────────────────
  { id: 'C2-001', step: 'Ca2', text: 'Where is the cat?', options: ['On the chair.', "It's black.", 'Yes, it is.'] },
  { id: 'C2-002', step: 'Ca2', text: 'Who has the ball?', options: ['Tom has it.', 'Under the table.', "It's red."] },
  { id: 'C2-003', step: 'Ca2', text: 'What is in your bag?', options: ['My lunch.', 'Yes, I do.', 'At school.'] },
  { id: 'C2-004', step: 'Ca2', text: 'How many apples are there?', options: ['Five.', "They're red.", 'On the table.'] },
  { id: 'C2-005', step: 'Ca2', text: 'When is your birthday?', options: ['In May.', "I'm eight.", 'At home.'] },
  { id: 'C2-006', step: 'Ca2', text: 'How old are you?', options: ["I'm seven.", "I'm fine, thank you.", 'In June.'] },
  { id: 'C2-007', step: 'Ca2', text: 'Can you swim?', options: ['Yes, I can.', 'Yes, it is.', 'In the sea.'] },
  { id: 'C2-008', step: 'Ca2', text: 'Is it raining?', options: ["No, it isn't.", "No, I can't.", 'No, I don\'t.'] },
  { id: 'C2-009', step: 'Ca2', text: 'Whose book is this?', options: ["It's Sam's.", "It's on the desk.", "It's big."] },
  { id: 'C2-010', step: 'Ca2', text: 'Why are you happy?', options: ["Because it's my birthday.", "At three o'clock.", 'With my friend.'] },
  { id: 'C2-011', step: 'Ca2', text: 'What are you doing?', options: ["I'm reading.", "I'm eight.", 'Yes, I am.'] },
  { id: 'C2-012', step: 'Ca2', text: 'Where do you live?', options: ['In a small house.', 'Every day.', 'My sister.'] },
  { id: 'C2-013', step: 'Ca2', text: 'Do you like bananas?', options: ['Yes, I do.', 'Yes, I am.', 'Yes, it is.'] },
  { id: 'C2-014', step: 'Ca2', text: 'How do you go to school?', options: ['By bus.', "At nine o'clock.", 'With my bag.'] },
  { id: 'C2-015', step: 'Ca2', text: "What's your name?", options: ['Lucy.', 'Fine, thanks.', 'Seven.'] },

  // ── Ca3: negation and time ─────────────────────────────────────────────────────────────────
  { id: 'C3-001', step: 'Ca3', context: 'Yesterday the dog was in the kitchen. Today it is in the bedroom.', text: 'Where is the dog today?', options: ['In the bedroom.', 'In the kitchen.', 'In the hall.'] },
  { id: 'C3-002', step: 'Ca3', context: 'The park is not open on Monday. It is open on Tuesday.', text: 'When can you go to the park?', options: ['On Tuesday.', 'On Monday.', 'On Sunday.'] },
  { id: 'C3-003', step: 'Ca3', context: 'Ben does not like milk. He likes orange juice.', text: 'What does Ben like?', options: ['Orange juice.', 'Milk.', 'Water.'] },
  { id: 'C3-004', step: 'Ca3', context: 'Last week Anna had short hair. Now her hair is long.', text: "What is Anna's hair like now?", options: ['Long.', 'Short.', 'Curly.'] },
  { id: 'C3-005', step: 'Ca3', context: 'This morning it was sunny. Now it is raining.', text: 'What is the weather like now?', options: ['It is raining.', 'It is sunny.', 'It is windy.'] },
  { id: 'C3-006', step: 'Ca3', context: 'The box is not empty. There are three pens in it.', text: 'What is in the box?', options: ['Three pens.', 'Nothing.', 'Three pencils.'] },
  { id: 'C3-007', step: 'Ca3', context: 'Tom did not walk to school today. His dad took him in the car.', text: 'How did Tom go to school today?', options: ['In the car.', 'He walked.', 'By bus.'] },
  { id: 'C3-008', step: 'Ca3', context: 'Yesterday Sue played tennis. Today she is playing basketball.', text: 'What is Sue playing today?', options: ['Basketball.', 'Tennis.', 'Baseball.'] },
  { id: 'C3-009', step: 'Ca3', context: 'The door is open, but the window is not.', text: 'What is closed?', options: ['The window.', 'The door.', 'The box.'] },
  { id: 'C3-010', step: 'Ca3', context: 'On Saturday the children were at the beach. On Sunday they were at home.', text: 'Where were the children on Sunday?', options: ['At home.', 'At the beach.', 'At school.'] },
  { id: 'C3-011', step: 'Ca3', context: "Kim isn't tall. Her brother is very tall.", text: 'Who is tall?', options: ["Kim's brother.", 'Kim.', 'Kim and her brother.'] },
  { id: 'C3-012', step: 'Ca3', context: 'The cat was sleeping this morning. Now it is eating.', text: 'What is the cat doing now?', options: ['Eating.', 'Sleeping.', 'Playing.'] },
  { id: 'C3-013', step: 'Ca3', context: 'Last year Matt was eight. Now he is nine.', text: 'How old was Matt last year?', options: ['Eight.', 'Nine.', 'Seven.'] },
  { id: 'C3-014', step: 'Ca3', context: 'Grace did not walk home. She took the bus.', text: 'How did Grace go home?', options: ['By bus.', 'She walked.', 'In a car.'] },
  { id: 'C3-015', step: 'Ca3', context: "There aren't any apples today. There are some bananas.", text: 'What fruit is there today?', options: ['Bananas.', 'Apples.', 'Pears.'] },

  // ── Ca4: order of events ───────────────────────────────────────────────────────────────────
  { id: 'C4-001', step: 'Ca4', context: 'Before Sam played with his cat, he read a comic. After that, he drew a picture.', text: 'What did Sam do first?', options: ['He read a comic.', 'He played with his cat.', 'He drew a picture.'] },
  { id: 'C4-002', step: 'Ca4', context: 'After Lucy played a game, she did her homework. Then she sang a song.', text: 'What did Lucy do first?', options: ['She played a game.', 'She did her homework.', 'She sang a song.'] },
  { id: 'C4-003', step: 'Ca4', context: 'Grace went swimming before she fed the fish. After that, she went to the library.', text: 'What did Grace do last?', options: ['She went to the library.', 'She went swimming.', 'She fed the fish.'] },
  { id: 'C4-004', step: 'Ca4', context: 'Dan watched TV after lunch. Before lunch, he read a comic. In the evening, he played in the park.', text: 'What did Dan do first?', options: ['He read a comic.', 'He watched TV.', 'He played in the park.'] },
  { id: 'C4-005', step: 'Ca4', context: 'After the party, Kim made a card. At the party, she sang songs. Before the party, she washed her hair.', text: 'When did Kim make the card?', options: ['After the party.', 'Before the party.', 'At the party.'] },
  { id: 'C4-006', step: 'Ca4', context: 'Hugo put on his coat after he put on his hat. Then he put on his scarf.', text: 'What did Hugo put on first?', options: ['His hat.', 'His coat.', 'His scarf.'] },
  { id: 'C4-007', step: 'Ca4', context: 'Ann went to the library. After that, she bought some bread. Then she had a drink at the café.', text: 'What did Ann do second?', options: ['She bought some bread.', 'She went to the library.', 'She had a drink.'] },
  { id: 'C4-008', step: 'Ca4', context: 'The children had music after lunch. Before lunch, they had art. English was the last lesson.', text: 'Which lesson was first?', options: ['Art.', 'Music.', 'English.'] },
  { id: 'C4-009', step: 'Ca4', context: 'Matt read a book. Before that, he had a bath. After the book, he played a game.', text: 'What did Matt do last?', options: ['He played a game.', 'He had a bath.', 'He read a book.'] },
  { id: 'C4-010', step: 'Ca4', context: 'Tom played with his dog before he found his ball. He found the ball under the car.', text: 'What did Tom do first?', options: ['He played with his dog.', 'He found his ball.', 'He washed the car.'] },
  { id: 'C4-011', step: 'Ca4', context: 'At the zoo, May saw the lions first and then the elephants. After that, she saw the monkeys.', text: 'Which animals did May see second?', options: ['The elephants.', 'The lions.', 'The monkeys.'] },
  { id: 'C4-012', step: 'Ca4', context: 'Bill drew a horse after he drew a cat. Then he drew a fish.', text: 'What did Bill draw first?', options: ['A cat.', 'A horse.', 'A fish.'] },
  { id: 'C4-013', step: 'Ca4', context: 'Sue went to the park. After that, she cleaned her room. Before the park, she had lunch.', text: 'What did Sue do first?', options: ['She had lunch.', 'She went to the park.', 'She cleaned her room.'] },
  { id: 'C4-014', step: 'Ca4', context: 'Before the rain, Eva was playing outside. After the rain, she read a book.', text: 'What did Eva do after the rain?', options: ['She read a book.', 'She played outside.', 'She closed the window.'] },
  { id: 'C4-015', step: 'Ca4', context: 'Before Nick fed the dog, he took it for a walk. After that, he ate his lunch.', text: 'What did Nick do first?', options: ['He took the dog for a walk.', 'He fed the dog.', 'He ate his lunch.'] },

  // ── Cd6: passive and relative pronouns ─────────────────────────────────────────────────────
  { id: 'D6-001', step: 'Cd6', text: 'The window ___ by the ball.', options: ['was broken', 'broke', 'was break'] },
  { id: 'D6-002', step: 'Cd6', text: 'This picture ___ by my brother last week.', options: ['was painted', 'painted', 'is paint'] },
  { id: 'D6-003', step: 'Cd6', text: 'The girl ___ sits next to me is called Anna.', options: ['who', 'which', 'what'] },
  { id: 'D6-004', step: 'Cd6', text: 'This is the book ___ I told you about.', options: ['that', 'who', 'what'] },
  { id: 'D6-005', step: 'Cd6', text: 'The dog ___ tail is white is mine.', options: ['whose', "who's", 'which'] },
  { id: 'D6-006', step: 'Cd6', text: 'The plants ___ every day.', options: ['are watered', 'water', 'are water'] },
  { id: 'D6-007', step: 'Cd6', text: 'The house ___ we live is very old.', options: ['where', 'which', 'who'] },
  { id: 'D6-008', step: 'Cd6', text: 'The game ___ because of the rain.', options: ['was stopped', 'stopped it', 'was stop'] },
  { id: 'D6-009', step: 'Cd6', text: 'The children ___ won the race got a prize.', options: ['who', 'which', 'whose'] },
  { id: 'D6-010', step: 'Cd6', text: 'The car ___ in Germany.', options: ['was made', 'made', 'was make'] },
  { id: 'D6-011', step: 'Cd6', text: 'Is this the pen ___ you lost?', options: ['that', 'who', 'where'] },
  { id: 'D6-012', step: 'Cd6', text: 'The song ___ by all the children.', options: ['was sung', 'sang', 'was sing'] },
  { id: 'D6-013', step: 'Cd6', text: 'The day ___ we went to the beach was very hot.', options: ['when', 'which', 'who'] },
  { id: 'D6-014', step: 'Cd6', text: 'These cakes ___ by my grandpa this morning.', options: ['were made', 'made', 'were make'] },
  { id: 'D6-015', step: 'Cd6', text: 'My uncle, ___ is a doctor, lives in London.', options: ['who', 'which', 'whose'] },

  // ── E1: two or three sentences, one detail ─────────────────────────────────────────────────
  { id: 'E1-001', step: 'E1', context: 'Kim has a red ball. She gives it to Tom.', text: 'Who has the ball now?', options: ['Tom.', 'Kim.', 'Her sister.'] },
  { id: 'E1-002', step: 'E1', context: 'Ben has a dog and a cat. The dog is black. The cat is white.', text: 'Which animal is black?', options: ['The dog.', 'The cat.', 'Both of them.'] },
  { id: 'E1-003', step: 'E1', context: 'Anna is at the zoo with her dad. They see a big lion.', text: 'Where is Anna?', options: ['At the zoo.', 'At school.', 'At home.'] },
  { id: 'E1-004', step: 'E1', context: 'Sam eats an orange. Then he drinks some water.', text: 'What does Sam drink?', options: ['Water.', 'Milk.', 'Orange juice.'] },
  { id: 'E1-005', step: 'E1', context: "Lucy's bag is under the table. Her book is in the bag.", text: "Where is Lucy's book?", options: ['In her bag.', 'Under the bed.', 'On the table.'] },
  { id: 'E1-006', step: 'E1', context: 'Dan has three pencils and two rulers.', text: 'How many rulers has Dan got?', options: ['Two.', 'Three.', 'Five.'] },
  { id: 'E1-007', step: 'E1', context: 'The bird is in the tree. The cat is under the tree.', text: 'Where is the cat?', options: ['Under the tree.', 'In the tree.', 'On the house.'] },
  { id: 'E1-008', step: 'E1', context: "Grace can ride a bike. Her little brother can't.", text: 'Who can ride a bike?', options: ['Grace.', 'Her brother.', 'Grace and her brother.'] },
  { id: 'E1-009', step: 'E1', context: "It is Matt's birthday. He is eight today.", text: 'How old is Matt?', options: ['Eight.', 'Six.', 'Seven.'] },
  { id: 'E1-010', step: 'E1', context: "Sue's grandma makes a cake. It is a chocolate cake.", text: 'Who makes the cake?', options: ["Sue's grandma.", 'Sue.', "Sue's dad."] },
  { id: 'E1-011', step: 'E1', context: 'There are four ducks in the water. Two are brown.', text: 'How many ducks are there?', options: ['Four.', 'Two.', 'Six.'] },
  { id: 'E1-012', step: 'E1', context: 'Nick is in the kitchen. He is making a sandwich.', text: 'What is Nick making?', options: ['A sandwich.', 'A cake.', 'A pizza.'] },
  { id: 'E1-013', step: 'E1', context: 'The children are at the beach. They are playing with a kite.', text: 'What are the children playing with?', options: ['A kite.', 'A ball.', 'A boat.'] },
  { id: 'E1-014', step: 'E1', context: 'Alice has a new kite. It is blue and yellow.', text: 'What has Alice got?', options: ['A new kite.', 'A new bike.', 'A new ball.'] },
  { id: 'E1-015', step: 'E1', context: "Hugo's cat is sleeping on his bed.", text: "Where is Hugo's cat?", options: ['On his bed.', 'Under his bed.', 'In the kitchen.'] },
]

const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const SENTENCES = SOURCE
// What a screen reads: options in a balanced order, key by option id. Feedback says the answer plainly.
export const SENTENCE_ITEMS = SOURCE.map(it => {
  const at = h(it.id) % 3
  const order = [...it.options.slice(1)]
  order.splice(at, 0, it.options[0])
  return {
    id: it.id, area: it.step.startsWith('E') ? 'E' : it.step.slice(0, 2), step: it.step, mode: 'read-choice',
    // Ca2 asks which answer fits the question, not what is true for the child. Asked straight ("Where do you live?")
    // a child answers for themselves ("my house is not small"), so the question is put in someone else's mouth.
    // No name for the one answering: one item's answer is a name ("Lucy."), and a named friend would contradict it.
    prompt: it.step === 'Ca2'
      ? { context: 'Ben asks his friend:', text: `“${it.text}”`, ask: 'What does his friend say?' }
      : { context: it.context, text: it.text },
    options: order.map((text, i) => ({ id: `o${i + 1}`, text })), key: `o${at + 1}`,
    feedback: { text: it.step === 'Cd6' ? it.text.replace('___', it.options[0]) : it.options[0] },
  }
})
