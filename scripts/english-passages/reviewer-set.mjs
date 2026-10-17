// Comparison set for the pedagogy reviewer: passages with a KNOWN logic or added-information fault, each
// next to its corrected version, plus clean items. Most faults are real ones a person found after the
// reviewer passed them (Astra's first E3 set, our own writer's runs); a few are written to the same
// pattern. It measures a reviewer, so it must not be written by the reviewer being measured.
//
// expect: { fault: 'logic' }                  passage logic_ok false, or reason_logical false on any question
//         { fault: 'adds_info', q: <1-based> } key_adds_info true on that question
//         { fault: null }                     clean: neither of those, on any question

const q = (op, stem, options, answer, evidence) => ({ op, stem, options, answer, evidence })

const chairBase = (reason, q3) => ({
  title: 'The Missing Chair',
  passage: `Ella walked to school with her grandfather Dan. Outside the bookshop, the big chair was missing. A small blue chair stood in its place. Ella stopped because she always waved to the big teddy sitting there. That afternoon, the teddy was back on the big chair. A woman was painting the small chair beside it. ${reason} Ella waved, and Dan gave the teddy a wave too.`,
  questions: [
    q('detail', 'What stood outside the bookshop that morning?', ['A little green table.', 'A little blue chair.', 'A little yellow box.'], 1, 'A small blue chair stood in its place.'),
    q('cause', 'Why did Ella stop at the bookshop?', ['She usually said hello to the teddy there.', 'She wanted to buy a book there.', 'She needed to give a book back there.'], 0, 'Ella stopped because she always waved to the big teddy sitting there.'),
    q3,
  ],
})
const pencilBase = (key) => ({
  title: 'The Pencil Catcher',
  passage: 'Sam kept dropping pencils behind his desk at home. He made a paper slide to catch them below the desk. His sister Lily came to watch the first try. The pencil went down the slide and straight into her shoe. Sam laughed, but Lily held up the pencil. He added a box because the pencil needed somewhere to stop. The box fell over because it was too light. Sam put a rock inside, and his pencil catcher worked.',
  questions: [
    q('detail', 'Where did the first pencil go?', ['Into a bag by the desk.', key, 'Into a cup on the floor.'], 1, 'The pencil went down the slide and straight into her shoe.'),
    q('cause', 'Why did Sam add a box?', ['To give the pencil a stopping place.', 'To make the slide a little taller.', 'To keep the paper slide straight.'], 0, 'He added a box because the pencil needed somewhere to stop.'),
    q('cause', 'Why did the box fall over?', ['Its bottom was wet.', 'Its shape was round.', 'It needed something heavier inside.'], 2, 'The box fell over because it was too light.'),
  ],
})

export const REVIEWER_SET = [
  // ── real faults, with their corrected versions ──────────────────────────────────────────────
  { id: 'chair-roof', expect: { fault: 'logic' }, source: 'Astra E3 v1, found by Claude and Astra',
    ...chairBase('She had moved the big chair inside because rain came through the roof.',
      q('cause', 'Why had the woman moved the big chair inside?', ['She needed more room for her books.', 'She wanted to change its paint.', 'She needed to keep the rain off it.'], 2, 'She had moved the big chair inside because rain came through the roof.')) },
  // Labelled clean at first; the pro reviewer flagged it on both runs and on reading it is right: if rain
  // wets the teddy, you bring the teddy in, not the chair, and a new chair is put out in the same rain.
  { id: 'chair-fixed', expect: { fault: 'logic' }, source: "Astra's correction; fault found by gemini-3.1-pro, confirmed by Claude",
    ...chairBase('She had brought the chair inside because rain was making the teddy wet.',
      q('cause', 'Why had the woman brought the big chair inside?', ['She needed more room for her books.', 'She wanted to change its paint.', 'The rain was making the teddy wet.'], 2, 'She had brought the chair inside because rain was making the teddy wet.')) },
  { id: 'pencil-wearing', expect: { fault: 'adds_info', q: 1 }, source: 'Astra E3 v1, found by Claude',
    ...pencilBase('Into the shoe Lily was wearing.') },
  { id: 'pencil-fixed', expect: { fault: null }, source: "Astra's correction",
    ...pencilBase('Into a shoe belonging to Lily.') },
  { id: 'station-water', expect: { fault: 'logic' }, source: 'our writer (gemini-3.1-pro, plan-first), passed every check',
    title: 'The Model Station',
    passage: 'Sam and Ella make a model station for their class. They put a big box on top. Then a ball hits the first box, so it falls down. Sam and Ella find a new box. They paint the new box. They do not add much water today, so the new box is strong. Now their station looks fantastic!',
    questions: [
      q('detail', 'What do Sam and Ella make?', ['A model station', 'A model ship', 'A model house'], 0, 'make a model station for their class'),
      q('cause', 'Why does the first box fall down?', ['Because a ball hits it', 'Because it is wet', 'Because Sam pushes it'], 0, 'a ball hits the first box, so it falls down'),
      q('cause', 'Why is the new box strong?', ['Because they do not add much water today', 'Because it is made of wood', 'Because Ella holds it'], 0, 'They do not add much water today, so the new box is strong'),
    ] },
  { id: 'omar-grass', expect: { fault: 'logic' }, source: 'our writer (gemini-3.5-flash), passed the first rubric',
    title: "Omar's Story",
    passage: 'Omar drew a pretty cat for his short story. The cat was lost in a big garden. A brave dog came to help the cat. The dog was afraid because the water was cold. He did not want to swim in the lake. Because he walked on the grass, the dog found the lost cat. The cat was happy to go home with Omar.',
    questions: [
      q('detail', 'What did Omar draw?', ['A pretty cat', 'A big dog', 'A small bird'], 0, 'Omar drew a pretty cat'),
      q('cause', 'Why was the dog afraid?', ['The water was cold', 'The garden was dark', 'The cat was angry'], 0, 'The dog was afraid because the water was cold'),
      q('cause', 'How did the dog find the lost cat?', ['He walked on the grass', 'He swam in the lake', 'He called the cat'], 0, 'Because he walked on the grass, the dog found the lost cat'),
    ] },
  // ── written to the same patterns ────────────────────────────────────────────────────────────
  { id: 'ice-sun', expect: { fault: 'logic' }, source: 'written for this set',
    title: 'The Ice Cube',
    passage: 'Mia put an ice cube on a plate in the garden. The sun was very hot. After ten minutes, the ice cube was bigger because the sun was hot. Mia called Tom to look at it. Tom laughed and put the plate in the shade. Then they went inside for some juice.',
    questions: [
      q('detail', 'Where did Mia put the plate?', ['In the garden', 'In the kitchen', 'On the bed'], 0, 'on a plate in the garden'),
      q('cause', 'Why was the ice cube bigger?', ['The sun was hot', 'Tom added water', 'The plate was cold'], 0, 'the ice cube was bigger because the sun was hot'),
      q('detail', 'Where did Tom put the plate?', ['In the shade', 'In the house', 'On the grass'], 0, 'put the plate in the shade'),
    ] },
  { id: 'red-shoes', expect: { fault: 'adds_info', q: 2 }, source: 'written for this set',
    title: 'Wet Shoes',
    passage: 'Ben walked home in the rain. His shoes were very wet, so he put them by the door. His grandmother gave him dry socks. Ben sat by the window and read his book. Later, the rain stopped and the sun came out. Ben put his dry shoes on and went to play.',
    questions: [
      q('detail', 'Who gave Ben dry socks?', ['His grandmother', 'His teacher', 'His friend'], 0, 'His grandmother gave him dry socks'),
      q('cause', 'Why did Ben put his shoes by the door?', ['His red shoes were full of rain', 'He wanted to clean them', 'They were too small'], 0, 'His shoes were very wet, so he put them by the door'),
      q('detail', 'What did Ben do by the window?', ['He read his book', 'He drew a picture', 'He ate lunch'], 0, 'Ben sat by the window and read his book'),
    ] },
  { id: 'park-mother', expect: { fault: 'adds_info', q: 1 }, source: 'written for this set',
    title: 'The Kite',
    passage: 'Lily walked to the park with her new kite. The wind was strong, so the kite went up very high. Then the string broke. The kite flew into a tree. A tall man helped Lily get it down. Lily said thank you and went home.',
    questions: [
      q('detail', 'Where did Lily go with her kite?', ['To the park with her mother', 'To the beach', 'To school'], 0, 'Lily walked to the park with her new kite'),
      q('cause', 'Why did the kite go up very high?', ['The wind was strong', 'Lily ran fast', 'The kite was new'], 0, 'The wind was strong, so the kite went up very high'),
      q('cause', 'Why did the kite fly into a tree?', ['The string broke', 'Lily let it go', 'A bird hit it'], 0, 'Then the string broke. The kite flew into a tree.'),
    ] },
  // ── clean items (read by a person; none of the two faults) ──────────────────────────────────
  { id: 'clean-shell', expect: { fault: null }, source: 'Astra E3 v1',
    title: 'The Little Shell',
    passage: 'Tom brought his best model plane to school in a big box. Mia, a new classmate, had a little white shell. Tom asked to swap his plane for her shell. He offered it because he wanted Mia to play with him. Mia looked at the plane, then at Tom. She gave the box back because she wanted a friend, not a plane. Then she put her shell between them on the table. They made a little island for it and played together.',
    questions: [
      q('detail', 'What did Mia bring to school?', ['A small white shell.', 'A little blue boat.', 'A small green frog.'], 0, 'Mia, a new classmate, had a little white shell.'),
      q('cause', 'Why did Tom offer his plane?', ['He wanted something for his garden.', 'He wanted someone to play with.', 'He wanted more room in his bag.'], 1, 'He offered it because he wanted Mia to play with him.'),
      q('cause', 'Why did Mia give the box back?', ['She wanted a different model.', 'She wanted a smaller toy.', 'She wanted someone to be friends with.'], 2, 'She gave the box back because she wanted a friend, not a plane.'),
    ] },
  // Also labelled clean at first: the rabbit runs on with the bag and the slow snail somehow puts every
  // apple back in it. Flagged by the pro reviewer on both runs; confirmed on reading.
  { id: 'clean-snail', expect: { fault: 'logic' }, source: 'Astra E3 v1; fault found by gemini-3.1-pro, confirmed by Claude',
    title: 'A Slow Hero',
    passage: 'Amir drew a comic about a snail who helped other animals. His friend Sara asked why the hero was so slow. Amir drew a rabbit running to a picnic with a bag. Apples fell out because the bag had a hole. The rabbit ran on, but the snail stopped beside a fallen apple. He found it because he moved slowly and watched the ground. Soon, all the apples were back in the bag. Sara drew the last picture: the snail eating the biggest apple.',
    questions: [
      q('detail', "What animal was the hero of Amir's comic?", ['A rabbit.', 'A mouse.', 'A snail.'], 2, 'Amir drew a comic about a snail who helped other animals.'),
      q('cause', 'Why did the apples fall out?', ['The rabbit dropped the open bag.', 'There was a break in the bag.', 'The rabbit put too many in the bag.'], 1, 'Apples fell out because the bag had a hole.'),
      q('cause', 'Why did the snail find the fallen apple?', ['He went slowly and looked down.', 'He stopped because the rabbit called.', 'He saw it because a bird pointed.'], 0, 'He found it because he moved slowly and watched the ground.'),
    ] },
  { id: 'clean-green-hat', expect: { fault: null }, source: 'our writer (gemini-3.1-pro, story-first)',
    title: 'The Green Hat',
    passage: 'It was raining loudly, so Jack looked out the window. He saw a little cat in his garden. The cat was very dry because it sat under a huge plant. The plant had very big leaves. The rain bounced off the top of the big leaves. Jack smiled because he understood the clever animal. The ground under the plant was safe and dry. The leaves were a great green hat!',
    questions: [
      q('detail', 'What did Jack see in his garden?', ['A big dog.', 'A small cat.', 'A black bird.'], 1, 'He saw a little cat in his garden.'),
      q('cause', 'Why did Jack look out the window?', ['His friends were calling him.', 'The children were laughing.', 'The rain was very loud.'], 2, 'It was raining loudly, so Jack looked out the window.'),
      q('cause', 'Why was the little cat dry?', ['It was sitting below a big plant.', 'It was hiding in a big box.', 'It ran into the house.'], 0, 'The cat was very dry because it sat under a huge plant.'),
    ] },
]
