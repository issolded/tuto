# E3 candidates — 2026-10-17T19:02

Models: writer gemini-3.1-pro-preview, safety gemini-3.8-flash ×2, pedagogy gemini-3.5-flash, blind solver gemma-4-31b-it.
Passed every automatic check: 8/8 (errors: 0). None is approved until a person reads it.

## The Blue Sock — `E3-lost-thing-trail` — PASSED CHECKS, awaiting human

Premise: Something goes missing at home. Small clues lead to a pet or a younger sibling who moved it for a harmless reason. _(source: own)_

> Amir could not find his blue sock. He looked under his bed. Then he saw white hair on the stairs. He walked downstairs so he could find his sock. His cat was inside a big box. She had the blue sock. She took it because she was cold. She was sleeping quietly on it. Amir smiled and got another pair.

1. **What did Amir see on the stairs?** _(detail)_
   - ▫️ Grass from his boots.
   - ▫️ Clothes from his bedroom.
   - ✅ Hair from his cat.
   - evidence: “Then he saw white hair on the stairs.”
   - blind solver: with text 2/2, without 1/3
2. **Why did Amir walk downstairs?** _(cause)_
   - ✅ He wanted to find his sock.
   - ▫️ He wanted to find his book.
   - ▫️ He wanted to eat his breakfast.
   - evidence: “He walked downstairs so he could find his sock.”
   - blind solver: with text 2/2, without 3/3
3. **Why did the cat take the sock?** _(cause)_
   - ✅ She did not want to be cold.
   - ▫️ She wanted to play a game.
   - ▫️ She was looking for food.
   - evidence: “She took it because she was cold.”
   - blind solver: with text 2/2, without 0/3

Rounds: 1 write → regenerate, 2 write → pass
- round 1: safety copyable-danger: Her baby brother Amir had her shoe! He put it in the water so his toy frogs could sail.
- reviewer notes: q2 guessable by a strong model without the text
- vocab: 60 words, 9 sentences, above level: —

## The Two Beans — `E3-plant-experiment` — PASSED CHECKS, awaiting human

Premise: Two children grow the same seeds in two places. One plant grows better, and they find out what made the difference. _(source: own)_

> Priya and Sara wanted to grow beans. Priya put her bean inside the house. Sara put her bean outside in the garden. Both girls gave them water every day. Sara had a very big green plant. Her plant grew well because it had sun. Priya only had a small weak plant. Her bean was small because it had no sun. So Priya put her plant in the garden too.

1. **Where did Sara put her bean?** _(detail)_
   - ▫️ It was out on the balcony.
   - ✅ It was out in the garden.
   - ▫️ It was in a flower box.
   - evidence: “Sara put her bean outside in the garden.”
   - blind solver: with text 2/2, without 3/3
2. **Why did Sara have a big plant?** _(cause)_
   - ✅ The plant sat in the sun.
   - ▫️ The plant grew in good ground.
   - ▫️ The plant had very good food.
   - evidence: “Her plant grew well because it had sun.”
   - blind solver: with text 2/2, without 3/3
3. **Why was Priya's plant small?** _(cause)_
   - ▫️ It did not get any food.
   - ✅ It did not get any sun.
   - ▫️ It was a bad bean.
   - evidence: “Her bean was small because it had no sun.”
   - blind solver: with text 2/2, without 3/3

Rounds: 1 write → pass
- reviewer notes: q1 guessable by a strong model without the text; q2 guessable by a strong model without the text; q3 guessable by a strong model without the text
- vocab: 69 words, 9 sentences, above level: —

## The Inside Picnic — `E3-rain-plan-change` — PASSED CHECKS, awaiting human

Premise: An outdoor plan is spoiled by rain, so the children change the plan, and the new plan turns out better. _(source: own)_

> Ravi and Rita wanted a picnic in the park. They could not go outside because it started to rain. Rita was sad about the wet weather. So, Ravi put a big blanket on two chairs. They made a great new house in the bedroom. The children ate their sandwiches inside the new house. The inside picnic was fantastic because there were no spiders. They want to eat in the house every weekend.

1. **Where did the children make their new house?** _(detail)_
   - ✅ In a room for sleeping.
   - ▫️ In a room for family games.
   - ▫️ In a room for family films.
   - evidence: “They made a great new house in the bedroom.”
   - blind solver: with text 2/2, without 1/3
2. **Why did the children not go outside?** _(cause)_
   - ▫️ It was a very cold day.
   - ▫️ They had to do their homework.
   - ✅ The weather was very wet.
   - evidence: “They could not go outside because it started to rain.”
   - blind solver: with text 2/2, without 3/3
3. **Why was the inside picnic fantastic?** _(cause)_
   - ✅ They did not see any scary animals.
   - ▫️ They ate a big chocolate cake.
   - ▫️ They drank a glass of lemonade.
   - evidence: “The inside picnic was fantastic because there were no spiders.”
   - blind solver: with text 2/2, without 0/3

Rounds: 1 write → revise, 2 repair → pass
- round 1: gate vocab-outside-lists: indoor
- reviewer notes: regional? In a room for family films.; q2 guessable by a strong model without the text
- vocab: 72 words, 8 sentences, above level: —

## The Red Box — `E3-helping-neighbour` — PASSED CHECKS, awaiting human

Premise: A child helps an older neighbour with a small job and learns something surprising about the neighbour. _(source: own)_

> Zoe helped an old man clean his dirty room. She opened a red box because it looked exciting. Inside the box, she found a big clown hat. Zoe was surprised because the man was always quiet. The old man smiled and put on the hat. He said he worked in a big circus. He wanted the hat so he could look at it.

1. **What was inside the red box?** _(detail)_
   - ▫️ A dirty coat for the cold.
   - ✅ Something funny to wear on the head.
   - ▫️ A small picture of a circus.
   - evidence: “Inside the box, she found a big clown hat.”
   - blind solver: with text 2/2, without 1/3
2. **Why did Zoe open the box?** _(cause)_
   - ▫️ She wanted to eat the chocolate inside it.
   - ▫️ She wanted to help him find his glasses.
   - ✅ She wanted to know what was in it.
   - evidence: “She opened a red box because it looked exciting.”
   - blind solver: with text 2/2, without 3/3
3. **Why was Zoe surprised?** _(cause)_
   - ▫️ The old man gave her a new toy.
   - ✅ The old man did not talk very much.
   - ▫️ The old man started to sing loudly.
   - evidence: “Zoe was surprised because the man was always quiet.”
   - blind solver: with text 2/2, without 1/3

Rounds: 1 write → pass
- reviewer notes: q2 guessable by a strong model without the text
- safety reviewer notes: A child being alone in the private room of an unspecified 'old man' ('Zoe helped an old man clean his dirty room') may raise safeguarding questions for some readers if the relationship is not specified. | A child being alone in an unspecified 'old man's dirty room' may raise minor safeguarding/stranger safety considerations for sensitive readers, though no harm or ill intent is depicted.
- vocab: 63 words, 7 sentences, above level: —

## The Model Ship — `E3-team-mistake` — PASSED CHECKS, awaiting human

Premise: A class team makes a mistake in a project. Instead of blaming one person, they find what went wrong and fix it. _(source: own)_

> Sam and Ella made a model ship for school. They painted the ship red and blue. Then Sam put a big sail on the ship. The ship fell down because the sail was too big. Ella was not angry with Sam. They wanted to fix the mistake so they worked carefully. Ella found a small paper square. Sam put it on the ship. Now the model ship looked fantastic!

1. **What were the children building?** _(detail)_
   - ▫️ A big house for a bird.
   - ✅ A small boat for a class.
   - ▫️ A funny kite for a friend.
   - evidence: “Sam and Ella made a model ship for school.”
   - blind solver: with text 2/2, without 3/3
2. **Why did the model ship fall down?** _(cause)_
   - ✅ The top part of the boat was huge.
   - ▫️ The bottom part of the boat was not flat.
   - ▫️ The front part of the boat was broken.
   - evidence: “The ship fell down because the sail was too big.”
   - blind solver: with text 2/2, without 1/3
3. **Why did the children work carefully together?** _(cause)_
   - ▫️ They needed to carry a big glass bowl for grandma.
   - ✅ They needed to make the bad work right again.
   - ▫️ They needed to help a good friend with difficult homework.
   - evidence: “They wanted to fix the mistake so they worked carefully.”
   - blind solver: with text 2/2, without 3/3

Rounds: 1 write → pass
- reviewer notes: q1 guessable by a strong model without the text; q3 guessable by a strong model without the text
- vocab: 69 words, 9 sentences, above level: together

## The Green Hat — `E3-animal-shelter-trick` — PASSED CHECKS, awaiting human

Premise: An animal finds a clever way to stay warm or dry, and a child works out how it did it. _(source: own)_

> It was raining loudly, so Jack looked out the window. He saw a little cat in his garden. The cat was very dry because it sat under a huge plant. The plant had very big leaves. The rain bounced off the top of the big leaves. Jack smiled because he understood the clever animal. The ground under the plant was safe and dry. The leaves were a great green hat!

1. **What did Jack see in his garden?** _(detail)_
   - ▫️ A big dog.
   - ✅ A small cat.
   - ▫️ A black bird.
   - evidence: “He saw a little cat in his garden.”
   - blind solver: with text 2/2, without 3/3
2. **Why did Jack look out the window?** _(cause)_
   - ▫️ His friends were calling him.
   - ▫️ The children were laughing.
   - ✅ The rain was very loud.
   - evidence: “It was raining loudly, so Jack looked out the window.”
   - blind solver: with text 2/2, without 3/3
3. **Why was the little cat dry?** _(cause)_
   - ✅ It was sitting below a big plant.
   - ▫️ It was hiding in a big box.
   - ▫️ It ran into the house.
   - evidence: “The cat was very dry because it sat under a huge plant.”
   - blind solver: with text 2/2, without 2/3

Rounds: 1 write → pass
- reviewer notes: q1 guessable by a strong model without the text; q2 guessable by a strong model without the text
- vocab: 70 words, 8 sentences, above level: —

## A Clever Idea — `E3-shy-to-brave` — PASSED CHECKS, awaiting human

Premise: A child is nervous about doing something in front of others. A small idea helps, and the child feels proud. _(source: own)_

> Max had to sing a song in class today. He was afraid because everyone would look at him. He wanted to hide inside his coat. Then he had a clever idea. He only looked at his friend Kofi, so he did not worry. Max stood at the front of the room. He sang the song very well. The children clapped loudly, and Max smiled. He was very happy about it.

1. **What did Max have to do?** _(detail)_
   - ▫️ Read a story from a book.
   - ▫️ Draw a picture on the board.
   - ✅ Use his voice to make music.
   - evidence: “Max had to sing a song in class today.”
   - blind solver: with text 2/2, without 3/3
2. **Why did Max feel afraid?** _(cause)_
   - ✅ All the class would be watching him.
   - ▫️ He had a bad cough and a headache.
   - ▫️ He could not find his homework in his bag.
   - evidence: “He was afraid because everyone would look at him.”
   - blind solver: with text 2/2, without 3/3
3. **Why did Max not worry?** _(cause)_
   - ▫️ He kept his eyes on the classroom clock.
   - ▫️ He sang the song with a good friend.
   - ✅ He kept his eyes on his classmate.
   - evidence: “He only looked at his friend Kofi, so he did not worry.”
   - blind solver: with text 2/2, without 0/3

Rounds: 1 write → pass
- reviewer notes: q1 guessable by a strong model without the text; q2 guessable by a strong model without the text
- vocab: 70 words, 9 sentences, above level: use, voice, feel, kept

## The Green Frog — `E3-animal-fact` — PASSED CHECKS, awaiting human

Premise: A short information text about how one well-known animal finds food or stays safe, with one cause and its effect. Facts must be true and simple. _(source: own)_

> A little green frog lives in the tall grass. Hungry birds fly above the grass to find food. The frog is green, so the birds can not see it. Sometimes a snake comes into the grass. The frog must move quickly to be safe. It jumps up because it has very strong back legs. The snake is slow and can not catch the frog. The safe frog goes to sleep on a big leaf.

1. **What flies above the grass to find food?** _(detail)_
   - ✅ Birds that want to eat.
   - ▫️ Bees that want to eat.
   - ▫️ Ducks that want to eat.
   - evidence: “Hungry birds fly above the grass to find food.”
   - blind solver: with text 2/2, without 3/3
2. **Why can the birds not see the frog?** _(cause)_
   - ▫️ It hides behind a big brown animal.
   - ✅ Its body is green like the grass.
   - ▫️ It goes into a big dirty lake.
   - evidence: “The frog is green, so the birds can not see it.”
   - blind solver: with text 2/2, without 3/3
3. **Why does the frog jump up?** _(cause)_
   - ✅ The legs at its back are very strong.
   - ▫️ It wants to catch a fly for dinner.
   - ▫️ It is afraid of a big brown dog.
   - evidence: “It jumps up because it has very strong back legs.”
   - blind solver: with text 2/2, without 0/3

Rounds: 1 write → regenerate, 2 write → pass
- round 1: safety false-fact: It lives in the hot green forest.; q1 pedagogy needs_text (An adult can easily answer that tigers eat meat using general knowledge.); q3 pedagogy needs_text (An adult can infer that tigers run fast to catch food/dinner without reading the text.); q1 solved WITHOUT the text 3/3 (and the reviewer agrees); q3 solved WITHOUT the text 3/3 (and the reviewer agrees)
- reviewer notes: q1 guessable by a strong model without the text; q2 guessable by a strong model without the text
- vocab: 74 words, 8 sentences, above level: —

## Model use

- gemini-3.1-pro-preview: 36 calls, 38441 in / 154252 out tokens
- gemma-4-31b-it: 83 calls, 16496 in / 74629 out tokens
- gemini-3.8-flash: 20 calls, 21136 in / 16723 out tokens
- gemini-3.5-flash: 10 calls, 8644 in / 14097 out tokens