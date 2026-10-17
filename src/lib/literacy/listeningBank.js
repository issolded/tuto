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

export const LISTENING_REVISION = 'listen-2'
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
    ['Grace', 'Is this your ruler, Ben? It was under my chair.'],
    ['Ben', 'No, mine is blue. That one is green.'],
    ['Grace', 'Then whose is it?'],
    ['Ben', "I think it's Lucy's. She sits next to you, and her bag is green too."],
  ], question: 'Whose ruler is it?', options: ["Lucy's.", "Ben's.", "Grace's."],
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

  { id: 'L5-021', step: 'A5', topic: 'School', lines: [
    ['Kim', 'Are you going to the art club after school, Nick?'],
    ['Nick', "No, not today. I'm going to the music club."],
    ['Kim', 'But you love drawing!'],
    ['Nick', 'I do, but on Tuesdays I play the guitar. I go to the art club on Thursdays.'],
  ], question: 'Which club is Nick going to today?', options: ['The music club.', 'The art club.', 'The sports club.'],
  feedback: 'The music club. He goes to the art club on Thursdays.' },

  { id: 'L5-022', step: 'A5', topic: 'Transport', lines: [
    ['Sue', 'Which bus goes to the zoo, Hugo?'],
    ['Hugo', 'The number twelve. The number ten goes to the station.'],
    ['Sue', 'And the number fifteen?'],
    ['Hugo', "That one goes to the beach. Don't take it, or you can't see the animals!"],
  ], question: 'Which bus goes to the zoo?', options: ['Number twelve.', 'Number ten.', 'Number fifteen.'],
  feedback: 'Number twelve. Number ten goes to the station.' },

  { id: 'L5-023', step: 'A5', topic: 'The home', lines: [
    ['Tom', 'Grace, have you got the key for my bike?'],
    ['Grace', 'No. I put it in the hall, next to the door.'],
    ['Tom', "It isn't there now."],
    ['Grace', 'Then Dad has it. He took your bike to the park this morning.'],
  ], question: 'Who has the key now?', options: ['Dad.', 'Grace.', 'Tom.'],
  feedback: 'Dad. He took the bike to the park.' },

  { id: 'L5-024', step: 'A5', topic: 'Food & drink', lines: [
    ['Matt', "I'm having chicken and rice. What about you, Lucy?"],
    ['Lucy', "I don't like rice. Can I have chicken and potatoes?"],
    ['Matt', "There aren't any potatoes today. There's salad."],
    ['Lucy', 'OK, chicken and salad, please.'],
    ['Matt', 'And to drink?'],
    ['Lucy', 'Some water, please.'],
  ], question: 'What is Lucy going to have?', options: ['Chicken and salad.', 'Chicken and rice.', 'Chicken and potatoes.'],
  feedback: "Chicken and salad. There aren't any potatoes today." },

  { id: 'L5-025', step: 'A5', topic: 'Family & friends', lines: [
    ['May', "What did you buy for Sam's birthday, Ben?"],
    ['Ben', 'A kite. Not a ball, he has lots of balls.'],
    ['May', 'Oh! I wanted to buy a kite too.'],
    ['Ben', 'You can buy a comic. Sam likes comics.'],
    ['May', 'Good idea!'],
  ], question: 'What is May going to buy for Sam?', options: ['A comic.', 'A kite.', 'A ball.'],
  feedback: 'A comic. Ben bought the kite.' },

  { id: 'L5-026', step: 'A5', topic: 'Weather', lines: [
    ['Alice', 'Is it going to be sunny on Sunday, Dan?'],
    ['Dan', "No, it's going to be cloudy and windy. But Saturday is going to be sunny."],
    ['Alice', 'And Monday?'],
    ['Dan', 'Rain, I think. Lots of rain.'],
    ['Alice', "Then let's go to the beach on Saturday!"],
  ], question: 'Which day is going to be sunny?', options: ['Saturday.', 'Sunday.', 'Monday.'],
  feedback: 'Saturday. Sunday is going to be cloudy and windy.' },

  { id: 'L5-027', step: 'A5', topic: 'School', lines: [
    ['Eva', 'How many children are in your class, Bill?'],
    ['Bill', 'Twenty-four. There are fourteen girls and ten boys.'],
    ['Eva', "In my class there are twenty. That's ten girls and ten boys."],
    ['Bill', 'So your class is smaller.'],
    ['Eva', 'Yes, but our classroom is bigger!'],
  ], question: "How many boys are in Bill's class?", options: ['Ten.', 'Fourteen.', 'Twenty.'],
  feedback: "Ten. There are fourteen girls in Bill's class." },

  { id: 'L5-028', step: 'A5', topic: 'Animals', lines: [
    ['Jill', "Mark, where's the cat? I looked in the kitchen."],
    ['Mark', 'She was on my bed this morning.'],
    ['Jill', "She isn't there now."],
    ['Mark', 'Look in the bathroom. She likes sleeping in the bath.'],
    ['Jill', "Yes! She's in the bath."],
  ], question: 'Where is the cat?', options: ['In the bath.', "On Mark's bed.", 'In the kitchen.'],
  feedback: 'In the bath. She was on the bed this morning.' },

  { id: 'L5-029', step: 'A5', topic: 'Sports & leisure', lines: [
    ['Nick', 'Did you play basketball after school today, Ann?'],
    ['Ann', 'Yes. The girls got six, and the boys got eight.'],
    ['Nick', 'Oh no! But six is good.'],
    ['Ann', 'Last week was better. We got ten, and the boys only got four.'],
  ], question: 'How many did the girls get today?', options: ['Six.', 'Eight.', 'Ten.'],
  feedback: 'Six. The boys got eight.' },

  { id: 'L5-030', step: 'A5', topic: 'Clothes', lines: [
    ['Grandma', 'Wear your blue shirt to the party, Sam.'],
    ['Sam', 'But I want to wear my green T-shirt.'],
    ['Grandma', 'That T-shirt is dirty. What about the white one?'],
    ['Sam', 'OK, the white T-shirt. Can I wear my new shoes too?'],
  ], question: 'Which T-shirt is Sam going to wear?', options: ['The white one.', 'The green one.', 'The blue one.'],
  feedback: 'The white one. The green T-shirt is dirty.' },

  { id: 'L5-031', step: 'A5', topic: 'School', lines: [
    ['Tom', "What's for lunch today, May? I'm really hungry."],
    ['May', "Pizza! And there's ice cream after it."],
    ['Tom', 'Great! On Monday we had fish, and I really don\'t like fish.'],
    ['May', "Oh no. On Wednesday there's fish again, Tom."],
  ], question: 'When is there pizza?', options: ['Today.', 'On Monday.', 'On Wednesday.'],
  feedback: 'Today. On Monday and Wednesday there is fish.' },

  { id: 'L5-032', step: 'A5', topic: 'School', lines: [
    ['Teacher', "Hugo, where's your homework?"],
    ['Hugo', "I did it, but it isn't in my bag. I think it's on my desk at home."],
    ['Teacher', 'Can you bring it on Monday?'],
    ['Hugo', 'Yes, I can. Sorry!'],
    ['Teacher', 'OK, Hugo. Put it in your bag this evening.'],
  ], question: "Where is Hugo's homework?", options: ['At home.', 'In his bag.', "On the teacher's desk."],
  feedback: 'At home. It is on his desk there.' },

  { id: 'L5-033', step: 'A5', topic: 'Food & drink', lines: [
    ['Kim', 'Dad, how many eggs do we need for the cake?'],
    ['Dad', 'Three. And we need some milk.'],
    ['Kim', 'We only have two eggs.'],
    ['Dad', "Then I'm going to buy six more. Can you get the milk?"],
    ['Kim', 'Yes! I can carry the milk.'],
  ], question: 'How many eggs have they got now?', options: ['Two.', 'Three.', 'Six.'],
  feedback: 'Two. They need three for the cake.' },

  { id: 'L5-034', step: 'A5', topic: 'Places & directions', lines: [
    ['Lucy', 'Where are you going, Ben?'],
    ['Ben', "To the swimming pool. I've got my towel."],
    ['Lucy', "The pool is closed today. It's Monday."],
    ['Ben', "Oh no! I don't want to go home. Then I'm going to the park. Do you want to come?"],
  ], question: 'Where is Ben going now?', options: ['To the park.', 'To the swimming pool.', 'Home.'],
  feedback: 'To the park. The pool is closed today.' },

  { id: 'L5-035', step: 'A5', topic: 'Family & friends', lines: [
    ['Sue', "Who's coming to the zoo with us on Saturday, Matt?"],
    ['Matt', 'My cousin Tom and his sister Jill.'],
    ['Sue', 'Is your brother coming too?'],
    ['Matt', "No, he's ill. He's at home in bed, and Grandma is with him."],
    ['Sue', 'Oh, I hope he is better soon.'],
  ], question: 'Who is coming to the zoo?', options: ['Tom and Jill.', "Matt's brother.", 'Grandma.'],
  feedback: "Tom and Jill. Matt's brother is ill." },

  { id: 'L5-036', step: 'A5', topic: 'School', lines: [
    ['Hugo', "What's your first lesson today, Grace?"],
    ['Grace', 'Art. Then we have music, and after lunch we have English.'],
    ['Hugo', 'My first lesson is music. Then we have English too.'],
    ['Grace', 'So we both have English and music today!'],
  ], question: "What is Grace's first lesson?", options: ['Art.', 'Music.', 'English.'],
  feedback: "Art. Hugo's first lesson is music." },

  { id: 'L5-037', step: 'A5', topic: 'The world around us', lines: [
    ['Eva', "Let's give our teacher some flowers. It's her birthday."],
    ['Bill', 'Red flowers or yellow flowers?'],
    ['Eva', 'She likes white flowers best.'],
    ['Bill', 'OK, white ones then. We can buy them after school.'],
    ['Eva', 'And we can make a card for her too.'],
  ], question: 'Which flowers are they going to buy?', options: ['White ones.', 'Red ones.', 'Yellow ones.'],
  feedback: 'White ones. Their teacher likes white flowers best.' },

  { id: 'L5-038', step: 'A5', topic: 'Places & directions', lines: [
    ['Dan', "Can you come to the library at two o'clock, Ann?"],
    ['Ann', "I can't at two. I've got a piano lesson. I can come at three."],
    ['Dan', "OK. Three o'clock at the library. Bring your new book!"],
    ['Ann', 'Great. See you there!'],
  ], question: 'What time are they going to the library?', options: ["At three o'clock.", "At two o'clock.", "At four o'clock."],
  feedback: "At three o'clock. Ann has a piano lesson at two." },

  { id: 'L5-039', step: 'A5', topic: 'Clothes', lines: [
    ['Sam', "I can't find my watch."],
    ['Jill', 'Is it in your coat?'],
    ['Sam', 'No. My gloves are in my coat, but not my watch.'],
    ['Jill', 'Is it on the table?'],
    ['Sam', "No, it isn't."],
    ['Jill', 'Look in your bag.'],
    ['Sam', 'Yes! Here it is. Thank you, Jill.'],
  ], question: "Where was Sam's watch?", options: ['In his bag.', 'In his coat.', 'On the table.'],
  feedback: 'In his bag. His gloves are in his coat.' },

  { id: 'L5-040', step: 'A5', topic: 'Animals', lines: [
    ['Kim', "How many animals are on your uncle's farm, Mark?"],
    ['Mark', 'He has four cows, two horses and lots of chickens.'],
    ['Kim', 'Has he got any sheep?'],
    ['Mark', "No, he hasn't. But he wants some."],
    ['Kim', 'I want to see the horses!'],
  ], question: "How many horses has Mark's uncle got?", options: ['Two.', 'Four.', 'Lots.'],
  feedback: 'Two. He has four cows.' },

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
  { id: 'L4-021', step: 'A4', topic: 'Family & friends', lines: n("Bill's party is on Friday after school. Sue's party is on Sunday afternoon."),
    question: "When is Sue's party?", options: ['On Sunday.', 'On Friday.', 'On Saturday.'], feedback: "On Sunday. Bill's party is on Friday." },
  { id: 'L4-022', step: 'A4', topic: 'Toys', lines: n('Anna has a red kite. Her friend Kim has a yellow kite with a long tail.'),
    question: 'Who has a yellow kite?', options: ['Kim.', 'Anna.', 'Anna and Kim.'], feedback: "Kim. Anna's kite is red." },
  { id: 'L4-023', step: 'A4', topic: 'The home', lines: n('The cat is in the bedroom. The dog is in the hall, and the bird is in the kitchen.'),
    question: 'Where is the bird?', options: ['In the kitchen.', 'In the hall.', 'In the bedroom.'], feedback: 'In the kitchen. The dog is in the hall.' },
  { id: 'L4-024', step: 'A4', topic: 'Time', lines: n("Matt eats an apple at eleven o'clock. At one o'clock, he has lunch with his friends."),
    question: 'When does Matt have lunch?', options: ["At one o'clock.", "At eleven o'clock.", "At twelve o'clock."], feedback: "At one o'clock. He eats an apple at eleven." },
  { id: 'L4-025', step: 'A4', topic: 'School', lines: n('Lucy has four pencils in her bag. Her brother has seven pencils and two rulers.'),
    question: 'How many pencils has Lucy got?', options: ['Four.', 'Seven.', 'Eleven.'], feedback: 'Four. Her brother has seven.' },
  { id: 'L4-026', step: 'A4', topic: 'Clothes', lines: n("Tom's T-shirt is green. His shorts are black, and his shoes are white."),
    question: 'Which of his clothes are black?', options: ['His shorts.', 'His T-shirt.', 'His shoes.'], feedback: 'His shorts. His T-shirt is green.' },
  { id: 'L4-027', step: 'A4', topic: 'Places & directions', lines: n('Grace goes to the library on Tuesday. On Thursday, she goes to the swimming pool.'),
    question: 'When does Grace go to the library?', options: ['On Tuesday.', 'On Thursday.', 'On Monday.'], feedback: 'On Tuesday. She goes swimming on Thursday.' },
  { id: 'L4-028', step: 'A4', topic: 'Family & friends', lines: n("Hugo's sister is eight. His brother is nine, and Hugo is six."),
    question: 'How old is Hugo?', options: ['Six.', 'Eight.', 'Nine.'], feedback: 'Six. His sister is eight and his brother is nine.' },
  { id: 'L4-029', step: 'A4', topic: 'School', lines: n('Eva is drawing a big horse. Her friend is drawing a fish in the sea.'),
    question: 'What is Eva drawing?', options: ['A horse.', 'A fish.', 'A bird.'], feedback: 'A horse. Her friend is drawing a fish.' },
  { id: 'L4-030', step: 'A4', topic: 'Food & drink', lines: n('Dan has a glass of milk for breakfast. His sister has orange juice.'),
    question: 'Who has orange juice?', options: ["Dan's sister.", 'Dan.', 'Their dad.'], feedback: "Dan's sister. Dan has milk." },
  { id: 'L4-031', step: 'A4', topic: 'The home', lines: n("Ann's school bag is on the chair. Her coat is on the floor."),
    question: "Where is Ann's coat?", options: ['On the floor.', 'On the chair.', 'In her bag.'], feedback: 'On the floor. Her bag is on the chair.' },
  { id: 'L4-032', step: 'A4', topic: 'Sports & leisure', lines: n('Mark plays the guitar after school. His friend Nick plays the piano.'),
    question: 'What does Nick play?', options: ['The piano.', 'The guitar.', 'Tennis.'], feedback: 'The piano. Mark plays the guitar.' },
  { id: 'L4-033', step: 'A4', topic: 'The home', lines: n('Sue lives on the first floor. Her friend May lives on the third floor.'),
    question: 'Where does May live?', options: ['On the third floor.', 'On the first floor.', 'On the second floor.'], feedback: 'On the third floor. Sue lives on the first floor.' },
  { id: 'L4-034', step: 'A4', topic: 'Transport', lines: n("The bus to the zoo goes at ten o'clock. The bus to the beach goes at nine."),
    question: 'When does the bus to the beach go?', options: ["At nine o'clock.", "At ten o'clock.", "At eleven o'clock."], feedback: "At nine o'clock. The bus to the zoo goes at ten." },
  { id: 'L4-035', step: 'A4', topic: 'Animals', lines: n("Jill's dog is white with a black tail. Her cat is black."),
    question: 'Which animal is white?', options: ["Jill's dog.", "Jill's cat.", "Jill's bird."], feedback: "Jill's dog. Her cat is black." },
  { id: 'L4-036', step: 'A4', topic: 'The home', lines: n('Sam puts his shoes under the bed. He puts his book on the table.'),
    question: 'Where does Sam put his book?', options: ['On the table.', 'Under the bed.', 'In his bag.'], feedback: 'On the table. His shoes are under the bed.' },
  { id: 'L4-037', step: 'A4', topic: 'The home', lines: n("Kim's brother and her mother are making a cake. Kim is washing the plates."),
    question: 'What is Kim doing?', options: ['Washing the plates.', 'Making a cake.', 'Reading a book.'], feedback: 'Washing the plates. Her brother and mother are making a cake.' },
  { id: 'L4-038', step: 'A4', topic: 'Sports & leisure', lines: n("Ben's grandpa has a big boat. Every Sunday, they go fishing on the river."),
    question: 'When do they go fishing?', options: ['On Sunday.', 'On Saturday.', 'Every day.'], feedback: 'On Sunday. They go every Sunday.' },
  { id: 'L4-039', step: 'A4', topic: 'Animals', lines: n("Alice's dog is two years old. Her cat is five years old."),
    question: 'How old is the cat?', options: ['Five.', 'Two.', 'Seven.'], feedback: 'Five. The dog is two.' },
  { id: 'L4-040', step: 'A4', topic: 'School', lines: n('Nick sits next to Hugo in class. Behind them, there are two girls, Lucy and May.'),
    question: 'Who sits next to Nick?', options: ['Hugo.', 'Lucy.', 'May.'], feedback: 'Hugo. Lucy and May sit behind them.' },
]

// Recording ids (scripts/english-audio/clips.mjs builds the same ones): the talk, the question, each option
// by its place in `options` (answer first), the feedback, and the instruction for each step.
export const listenClip = {
  talk: id => `ld-${id}`, question: id => `lq-${id}`, option: (id, i) => `lo-${id}-${i + 1}`, feedback: id => `lf-${id}`,
  instruction: step => (step === 'A5' ? 'i-listen-answer' : 'i-listen-choose'),
}

// Order the child sees: the answer moves to position (hash of id) % 3, the wrong options keep their order.
const h = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const LISTENING = SOURCE
export const LISTENING_ITEMS = SOURCE.map(it => {
  const at = h(it.id) % 3
  const order = [...it.options.slice(1)]
  order.splice(at, 0, it.options[0])
  return { ...it, choices: order.map((text, i) => ({ id: `o${i + 1}`, text, audio: listenClip.option(it.id, it.options.indexOf(text)) })), key: `o${at + 1}` }
})
