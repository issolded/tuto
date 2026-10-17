// Listening bank, area A, steps A4 and A5 (docs/ENGLISH-SKILL-LADDERS.md): everything is heard, nothing
// is read, so these items need no pictures. Written for Tuto (2026-10-17, Claude); no book text.
//
// A4: a narrator says 2–3 short sentences; a who / what / where / when question.
// A5: two children talk (35–65 words); one question: an explicit detail or one-step inference.
// Each item: lines [speaker, text], question, options [ANSWER FIRST, wrong, wrong], feedback.
// The wrong options are, where possible, said in the talk too, so that only listening tells them
// apart. The order a child sees is set below from the id (balanced key positions), never by hand.
//
// Rules (checked by scripts/english-listening/check.mjs): Starters + Movers words (A4 ≤ 1, A5 ≤ 2 Flyers
// words), no word that differs between UK and US English, sentences ≤ 15 words, two speakers of
// different voices in A5. Audio: scripts/english-audio/clips.mjs (`--set listening`). Answer keys are
// here because the lab is a reviewer tool; a child screen gets items from the server without the key.

export const LISTENING_REVISION = 'listen-1'
export const NARRATOR = 'narrator'
// Names from the Cambridge Starters list (+ family words); the gender picks the voice in clips.mjs.
export const SPEAKER_GENDER = {
  Alice: 'female', Ann: 'female', Anna: 'female', Eva: 'female', Grace: 'female', Jill: 'female', Kim: 'female',
  Lucy: 'female', May: 'female', Sue: 'female', Grandma: 'female', Teacher: 'female',
  Ben: 'male', Bill: 'male', Dan: 'male', Hugo: 'male', Mark: 'male', Matt: 'male', Nick: 'male', Sam: 'male',
  Tom: 'male', Dad: 'male', Grandpa: 'male',
}

const n = text => [[NARRATOR, text]]
const SOURCE = [
  // ── A5: short talks ─────────────────────────────────────────────────────────────────────────
  { id: 'L5-001', step: 'A5', topic: 'School', lines: [
    ['Ann', 'Is this your ruler, Ben? It was under my chair.'],
    ['Ben', 'No, mine is blue. That one is green.'],
    ['Ann', 'Then whose is it?'],
    ['Ben', "I think it's Lucy's. She sits next to you, and her bag is green too."],
  ], question: 'Whose ruler is it?', options: ["Lucy's.", "Ben's.", "Ann's."],
  feedback: "Lucy's. Ben's ruler is blue." },

  { id: 'L5-002', step: 'A5', topic: 'The home', lines: [
    ['Kim', "Dad, I can't find my hat. It isn't in my bedroom."],
    ['Dad', 'Did you look in the hall? You wore it yesterday.'],
    ['Kim', "Yes, but it isn't there."],
    ['Dad', 'Oh, wait. I put it in the car this morning.'],
  ], question: "Where is Kim's hat?", options: ['In the car.', 'In the hall.', 'In her bedroom.'],
  feedback: 'In the car. Dad put it there this morning.' },

  { id: 'L5-003', step: 'A5', topic: 'Weather', lines: [
    ['Matt', "Let's go to the park tomorrow afternoon."],
    ['Grace', "I can't. My grandma is coming to our house tomorrow."],
    ['Matt', 'What about tomorrow morning?'],
    ['Grace', "It's going to rain in the morning. Let's go today, after lunch. It's sunny now."],
  ], question: 'When are they going to the park?', options: ['After lunch today.', 'Tomorrow afternoon.', 'Tomorrow morning.'],
  feedback: "After lunch today. Grace's grandma is coming tomorrow." },

  { id: 'L5-004', step: 'A5', topic: 'Animals', lines: [
    ['Eva', 'Look at my new pet, Sam!'],
    ['Sam', 'Is it a mouse?'],
    ['Eva', "No, it's a rabbit. It's small because it's a baby."],
    ['Sam', 'Does it sleep in your bedroom?'],
    ['Eva', 'No, Dad said no. It sleeps in a box in the kitchen.'],
  ], question: 'Where does the rabbit sleep?', options: ['In the kitchen.', "In Eva's bedroom.", 'In the living room.'],
  feedback: 'In the kitchen. It sleeps in a box there.' },

  { id: 'L5-005', step: 'A5', topic: 'Transport', lines: [
    ['Nick', 'How do you get to school, Alice?'],
    ['Alice', 'I usually walk with my brother. But today Dad took us in the car.'],
    ['Nick', 'Why?'],
    ['Alice', 'Because it was raining a lot. Sometimes I go by bus, when Dad starts work early.'],
  ], question: 'How did Alice get to school today?', options: ['By car.', 'She walked.', 'By bus.'],
  feedback: 'By car. Dad took her because it was raining.' },

  { id: 'L5-006', step: 'A5', topic: 'Food & drink', lines: [
    ['Hugo', "Can I have an orange, May? I'm thirsty."],
    ['May', 'Sorry, there are only three now. We bought six on Monday.'],
    ['Hugo', 'Who ate the other three?'],
    ['May', 'I ate two, and my brother ate one. He really likes apples more.'],
  ], question: "How many oranges did May's brother eat?", options: ['One.', 'Two.', 'Three.'],
  feedback: 'One. May ate two, and her brother ate one.' },

  { id: 'L5-007', step: 'A5', topic: 'Sports & leisure', lines: [
    ['Ann', 'Did you have a good sports day, Tom?'],
    ['Tom', 'Yes! We played a running game. Bill was first, and I was second.'],
    ['Ann', 'And Dan?'],
    ['Tom', "Dan fell and hurt his leg. But he's OK now. He was third."],
  ], question: 'Who was first in the running game?', options: ['Bill.', 'Tom.', 'Dan.'],
  feedback: 'Bill. Tom was second.' },

  { id: 'L5-008', step: 'A5', topic: 'Clothes', lines: [
    ['Grandpa', "Lucy, take your coat. It's cold outside."],
    ['Lucy', "But I've got my warm scarf, Grandpa."],
    ['Grandpa', 'The scarf is nice, but you need your coat too. And your hat.'],
    ['Lucy', 'OK. Can I take my umbrella?'],
    ['Grandpa', "You don't need it. It isn't raining."],
  ], question: 'What does Grandpa want Lucy to take?', options: ['Her coat and her hat.', 'Her umbrella.', 'Only her scarf.'],
  feedback: 'Her coat and her hat. It is cold outside.' },

  { id: 'L5-009', step: 'A5', topic: 'Toys', lines: [
    ['Ben', "I can't find my robot. I played with it in the living room, then I had dinner in the kitchen."],
    ['Jill', 'Our dog likes to take toys to his bed. Look there.'],
    ['Ben', "No, it's not there."],
    ['Jill', 'Did you look under the sofa?'],
    ['Ben', 'Here it is!'],
  ], question: 'Where was the robot?', options: ['Under the sofa.', "In the dog's bed.", 'In the kitchen.'],
  feedback: "Under the sofa. It was not in the dog's bed." },

  { id: 'L5-010', step: 'A5', topic: 'Family & friends', lines: [
    ['Sue', 'When is your birthday party, Matt? Can I come?'],
    ['Matt', "Yes! It's on Friday. My birthday is on Thursday, but I've got a swimming lesson then."],
    ['Sue', 'Why not on Saturday?'],
    ['Matt', "On Saturday we're going to see my grandma. So the party is on Friday."],
  ], question: "When is Matt's party?", options: ['On Friday.', 'On Thursday.', 'On Saturday.'],
  feedback: 'On Friday. His birthday is on Thursday.' },

  { id: 'L5-011', step: 'A5', topic: 'School', lines: [
    ['Grace', 'Why are you sad, Dan?'],
    ['Dan', "I want to take this book home, but I can't."],
    ['Grace', 'Is your library card at home?'],
    ['Dan', 'No, it is in my bag. But I have three books at home, and you can only have three.'],
    ['Grace', 'Bring one back next week. Then you can take this one.'],
  ], question: "Why can't Dan take the book home?", options: ['He has too many books.', 'His card is at home.', 'Grace wants to read it.'],
  feedback: 'He has too many books. He has three at home already.' },

  { id: 'L5-012', step: 'A5', topic: 'Animals', lines: [
    ['Eva', 'Which animal did you like best at the zoo, Hugo?'],
    ['Hugo', 'The monkeys were funny, but I liked the elephants best.'],
    ['Eva', 'I liked the lions. They were sleeping all day!'],
    ['Hugo', "Yes, they didn't move at all."],
  ], question: 'Which animal did Hugo like best?', options: ['The elephants.', 'The monkeys.', 'The lions.'],
  feedback: 'The elephants. He thought the monkeys were funny, but he liked the elephants best.' },

  { id: 'L5-013', step: 'A5', topic: 'Sports & leisure', lines: [
    ['Kim', "We're going to the beach on Saturday, Grandpa. What do I need?"],
    ['Grandpa', "Take your hat. The sun is very hot there. You don't need a towel. I've got two in the car."],
    ['Kim', 'Can I take my ball?'],
    ['Grandpa', 'Yes, of course.'],
  ], question: 'What is Kim going to take?', options: ['Her hat and her ball.', 'Her towel and her hat.', 'Her towel and her ball.'],
  feedback: 'Her hat and her ball. Grandpa has towels in the car.' },

  { id: 'L5-014', step: 'A5', topic: 'Food & drink', lines: [
    ['Sam', "I'm really hungry, Ann."],
    ['Ann', "Didn't you have breakfast this morning?"],
    ['Sam', "No. I usually get up at seven o'clock, but today I got up at eight."],
    ['Ann', "School starts at nine, so you didn't have time. Here, have one of my sandwiches."],
  ], question: 'What time did Sam get up today?', options: ["At eight o'clock.", "At seven o'clock.", "At nine o'clock."],
  feedback: "At eight o'clock. He usually gets up at seven." },

  { id: 'L5-015', step: 'A5', topic: 'School', lines: [
    ['Lucy', 'Can I use your paints, Mark?'],
    ['Mark', 'Yes, but not the yellow. I need it for my sun.'],
    ['Lucy', 'OK. I want to paint the sea. Can I have the blue and the green?'],
    ['Mark', 'Sure, take them.'],
  ], question: 'Which paint does Mark need?', options: ['The yellow one.', 'The blue one.', 'The green one.'],
  feedback: 'The yellow one. He needs it for his sun.' },

  { id: 'L5-016', step: 'A5', topic: 'Animals', lines: [
    ['Bill', "Have you seen my dog? He ran out of our house this morning. He's small and brown."],
    ['Sue', 'I saw a small black dog in the park. It was playing with a ball.'],
    ['Bill', 'Mine is brown, not black.'],
    ['Sue', 'Oh! There was a brown dog at the café. It was sleeping under a table.'],
  ], question: "Where did Sue see Bill's dog?", options: ['At the café.', 'In the park.', "At Bill's house."],
  feedback: 'At the café. The dog in the park was black.' },

  { id: 'L5-017', step: 'A5', topic: 'Sports & leisure', lines: [
    ['Jill', "When is your swimming lesson, Nick? Is it at three o'clock, like last week?"],
    ['Nick', "No, now it starts at four o'clock."],
    ['Jill', "My lesson is at five o'clock."],
    ['Nick', 'Mine stops at five! I can see you at the pool.'],
  ], question: "When does Nick's lesson start now?", options: ["At four o'clock.", "At five o'clock.", "At three o'clock."],
  feedback: "At four o'clock. Last week it was at three." },

  { id: 'L5-018', step: 'A5', topic: 'The home', lines: [
    ['Grandma', 'Can you help me, Tom?'],
    ['Tom', 'Yes! What can I do?'],
    ['Grandma', "Please wash the cups. Don't clean the table, I did that."],
    ['Tom', 'Can I make the cake with you after that?'],
    ['Grandma', 'Of course. First the cups, then the cake.'],
  ], question: 'What does Grandma want Tom to do first?', options: ['Wash the cups.', 'Make the cake.', 'Clean the table.'],
  feedback: 'Wash the cups. Then they can make the cake.' },

  { id: 'L5-019', step: 'A5', topic: 'School', lines: [
    ['Teacher', 'Good morning, Dan. Please sit next to Kim today.'],
    ['Dan', "But I always sit next to Sam. He's my best friend."],
    ['Teacher', "I know, but Sam isn't here today. He's ill at home."],
    ['Dan', 'Oh, OK. Hello, Kim! Can I sit here?'],
  ], question: 'Who does Dan sit next to today?', options: ['Kim.', 'Sam.', 'The teacher.'],
  feedback: 'Kim. Sam is not at school today.' },

  { id: 'L5-020', step: 'A5', topic: 'Food & drink', lines: [
    ['Alice', 'What shall we take to the picnic?'],
    ['Matt', "I've got bread, cheese and some tomatoes."],
    ['Alice', 'I can bring some fruit. Bananas?'],
    ['Matt', "My brother doesn't like bananas. Can you bring some grapes?"],
    ['Alice', 'OK, grapes and some water.'],
  ], question: 'What is Alice going to bring?', options: ['Grapes and water.', 'Bread and cheese.', 'Bananas.'],
  feedback: "Grapes and water. Matt's brother doesn't like bananas." },

  // ── A4: two or three sentences ─────────────────────────────────────────────────────────────────
  { id: 'L4-001', step: 'A4', topic: 'Animals', lines: n('Tom has a big brown dog. His sister Kim has two small cats.'),
    question: 'Who has cats?', options: ['Kim.', 'Tom.', 'Tom and Kim.'], feedback: 'Kim. Tom has a dog.' },
  { id: 'L4-002', step: 'A4', topic: 'School', lines: n("Anna's bag is red. Her brother's bag is blue, and it has a big star on it."),
    question: 'Which bag has a star?', options: ['The blue bag.', 'The red bag.', "Anna's bag."], feedback: "The blue bag. It is her brother's bag." },
  { id: 'L4-003', step: 'A4', topic: 'Sports & leisure', lines: n('On Monday, Sam has a swimming lesson. On Wednesday, he plays tennis with his dad.'),
    question: 'When does Sam play tennis?', options: ['On Wednesday.', 'On Monday.', 'On Sunday.'], feedback: 'On Wednesday. He swims on Monday.' },
  { id: 'L4-004', step: 'A4', topic: 'Animals', lines: n("Ben's dog is sleeping on the sofa. His cat is sleeping under the table."),
    question: 'Where is the dog sleeping?', options: ['On the sofa.', 'Under the table.', 'On the bed.'], feedback: 'On the sofa. The cat is under the table.' },
  { id: 'L4-005', step: 'A4', topic: 'Food & drink', lines: n("Grace likes oranges, but she doesn't like bananas. Her brother likes bananas."),
    question: 'Who likes bananas?', options: ["Grace's brother.", 'Grace.', 'Grace and her brother.'], feedback: "Grace's brother. Grace likes oranges." },
  { id: 'L4-006', step: 'A4', topic: 'Transport', lines: n('Mark walks to school with his friend Bill. After school, his dad comes in the car.'),
    question: 'How does Mark go home?', options: ['In the car.', 'He walks.', 'By bus.'], feedback: 'In the car. His dad comes after school.' },
  { id: 'L4-007', step: 'A4', topic: 'The home', lines: n('Jill is reading a book in the living room. Her brother is playing a game in the kitchen.'),
    question: 'Where is Jill?', options: ['In the living room.', 'In the kitchen.', 'In the bedroom.'], feedback: 'In the living room. Her brother is in the kitchen.' },
  { id: 'L4-008', step: 'A4', topic: 'Weather', lines: n('It is raining, so Nick takes his coat. His sister takes her umbrella.'),
    question: 'What does Nick take?', options: ['His coat.', 'His umbrella.', 'His hat.'], feedback: 'His coat. His sister takes the umbrella.' },
  { id: 'L4-009', step: 'A4', topic: 'Family & friends', lines: n("Dan's grandma lives in a big city. Dan's school is near the beach."),
    question: "Where does Dan's grandma live?", options: ['In a big city.', 'Near the beach.', "Near Dan's school."], feedback: "In a big city. Dan's school is near the beach." },
  { id: 'L4-010', step: 'A4', topic: 'Work', lines: n("May's mother is a doctor. Her father is a teacher at May's school."),
    question: "Who works at May's school?", options: ['Her father.', 'Her mother.', 'Her doctor.'], feedback: 'Her father. Her mother is a doctor.' },
  { id: 'L4-011', step: 'A4', topic: 'Animals', lines: n('Hugo has three fish and one bird. His friend has a rabbit.'),
    question: 'How many fish has Hugo got?', options: ['Three.', 'One.', 'Two.'], feedback: 'Three. He has one bird.' },
  { id: 'L4-012', step: 'A4', topic: 'Family & friends', lines: n("Sue's party starts at three o'clock. Her friends go home at six."),
    question: 'When do her friends go home?', options: ["At six o'clock.", "At three o'clock.", "At five o'clock."], feedback: "At six o'clock. The party starts at three." },
  { id: 'L4-013', step: 'A4', topic: 'School', lines: n('Alice draws a big house. Then she paints a yellow sun above it.'),
    question: 'What does Alice paint?', options: ['A sun.', 'A house.', 'A tree.'], feedback: 'A sun. She draws the house.' },
  { id: 'L4-014', step: 'A4', topic: 'Sports & leisure', lines: n("Matt can swim, but he can't ride a horse. His sister can ride a horse."),
    question: 'Who can ride a horse?', options: ["Matt's sister.", 'Matt.', 'Matt and his sister.'], feedback: "Matt's sister. Matt can swim." },
  { id: 'L4-015', step: 'A4', topic: 'The home', lines: n('Kim puts the bread in her bag. Then she puts the milk on the table.'),
    question: 'Where does Kim put the bread?', options: ['In her bag.', 'On the table.', 'In the fridge.'], feedback: 'In her bag. The milk goes on the table.' },
  { id: 'L4-016', step: 'A4', topic: 'Clothes', lines: n("Bill's shoes are under his bed. His socks are on the chair."),
    question: "Where are Bill's socks?", options: ['On the chair.', 'Under his bed.', 'In a box.'], feedback: 'On the chair. His shoes are under his bed.' },
  { id: 'L4-017', step: 'A4', topic: 'Food & drink', lines: n('Ann and her dad make pancakes on Saturday evening. They eat them with lemon.'),
    question: 'When do they make pancakes?', options: ['On Saturday evening.', 'On Saturday morning.', 'On Sunday morning.'], feedback: 'On Saturday evening.' },
  { id: 'L4-018', step: 'A4', topic: 'Family & friends', lines: n("The baby is sleeping in Tom's room, so Tom reads a comic in the kitchen. His dad is in the living room."),
    question: 'Where does Tom read?', options: ['In the kitchen.', 'In his room.', 'In the living room.'], feedback: "In the kitchen. The baby is sleeping in Tom's room." },
  { id: 'L4-019', step: 'A4', topic: 'School', lines: n("Lucy's teacher has long black hair. Her friend's teacher has short brown hair."),
    question: 'Who has short brown hair?', options: ["Her friend's teacher.", "Lucy's teacher.", "Lucy's friend."], feedback: "Her friend's teacher. Lucy's teacher has long hair." },
  { id: 'L4-020', step: 'A4', topic: 'Transport', lines: n('Nick wants to go to the park, but his bike is broken. He walks there with his brother.'),
    question: 'How does Nick go to the park?', options: ['He walks.', 'By bike.', 'In the car.'], feedback: 'He walks. His bike is broken.' },
]

// Order the child sees: the answer moves to position (hash of id) % 3, the wrong options keep their order.
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const LISTENING = SOURCE
export const LISTENING_ITEMS = SOURCE.map(it => {
  const at = h(it.id) % 3
  const order = [...it.options.slice(1)]
  order.splice(at, 0, it.options[0])
  return { ...it, choices: order.map((text, i) => ({ id: `o${i + 1}`, text })), key: `o${at + 1}` }
})
