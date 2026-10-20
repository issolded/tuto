// Original pilot content, authored for Tuto. No workbook text or WordNet imports.
// Common UK/US spellings and meanings only. No phonics or pronunciation claims.
export const CONTENT_VERSION = 'literacy-pilot-1'
export const WORDS = `cat|an animal that meows
 dog|an animal that barks
 bird|an animal with feathers
 fish|an animal with fins that lives in water
 duck|a swimming bird with a wide, flat beak
 hen|a female chicken
 pig|a farm animal with a snout and a curly tail
 cow|a large farm animal that gives milk
 sheep|a farm animal with a woolly coat
 goat|a farm animal often shown with a beard
 horse|a large animal that people can ride
 rabbit|an animal with long ears and a short fluffy tail
 mouse|a small animal with a long thin tail
 lion|a large wild cat whose male has a mane
 tiger|a large wild cat with dark stripes
 bear|a large furry animal with strong paws
 monkey|an animal with hands that often climbs trees
 snake|a long animal with no legs
 frog|a small animal that jumps and begins life as a tadpole
 bee|an insect that makes honey
 ant|a small insect that lives in a colony
 spider|an animal with eight legs
 apple|a round fruit with a core and a red or green skin
 banana|a long fruit with a yellow skin when ripe
 lemon|a yellow fruit with a sour taste
 grape|a small round fruit that grows in bunches on a vine
 carrot|a long orange vegetable that grows under the soil
 onion|a vegetable with layers that can make your eyes water when cut
 potato|a vegetable that grows underground and can be mashed
 bread|a food made from dough and baked in a loaf
 rice|small grains often cooked in water and eaten with a meal
 milk|a white drink that can come from a cow
 egg|a food with a shell, a white part and a yolk
 soup|a liquid food often eaten warm with a spoon
 cheese|a solid food made from milk
 cake|a sweet baked food often served at a birthday party
 spoon|a tool with a small bowl at one end, used for eating
 fork|a tool with pointed prongs, used for eating
 plate|a flat dish for holding food
 bowl|a deep round dish for holding food
 cup|a small drinking container, often with a handle
 pan|a container used for cooking on a stove
 bed|a piece of furniture for sleeping on
 chair|a seat with a back, usually for one person
 table|a piece of furniture with a flat top for eating or working
 door|a moving panel that opens an entrance to a room
 window|an opening with glass that lets light into a room
 wall|an upright part of a building that separates rooms
 roof|the top covering of a building
 floor|the surface at the bottom of a room that you walk on
 lamp|an object that gives light when switched on
 clock|an object that shows the time
 key|a small shaped object used to open a lock
 brush|a tool with bristles for cleaning or painting
 soap|something you use with water to wash your hands
 towel|a piece of cloth for drying yourself
 book|pages joined together inside a cover
 pencil|a wooden writing tool that can be sharpened and whose marks can be erased
 ruler|a straight tool marked with units for measuring length
 bag|a container with an opening at the top for carrying things
 box|a container with flat sides, often made of cardboard
 ball|a round object used in many games
 kite|a light object flown in the wind on a string
 rope|a thick cord used for tying or pulling
 bell|an object that makes a ringing sound when struck
 drum|an instrument you hit to make a beat
 hat|something you wear on your head
 sock|something you wear on your foot inside a shoe
 shoe|an outer covering for a foot, worn when walking
 coat|an outer piece of clothing worn to keep warm
 shirt|clothing for the upper body, often with a collar and buttons
 hand|the part of your body with fingers and a thumb
 foot|the part at the end of your leg that you stand on
 eye|the part of your body that you see with
 ear|the part of your body that you hear with
 nose|the part of your face that you smell with
 mouth|the opening in your face that you eat with
 tooth|a hard white part inside your mouth used for biting
 tree|a tall plant with a wooden trunk
 leaf|a flat part of a plant, often green
 flower|the part of a plant that has petals
 seed|a small part of a plant that can grow into a new plant
 grass|small green plants that often cover a lawn
 rock|a hard solid piece of natural material from the ground
 sand|tiny loose grains found on many beaches
 river|a long natural flow of water across the land
 lake|a large area of water surrounded by land
 hill|an area of land higher than the land around it
 cloud|a mass of tiny water drops floating in the sky
 rain|water drops falling from clouds
 snow|soft white flakes of frozen water falling from clouds
 wind|air moving outside
 sun|the star that gives Earth light and warmth
 moon|the natural object that travels around Earth
 boat|a vehicle that travels on water
 train|a line of connected vehicles that runs on tracks
 bus|a large road vehicle that carries many passengers
 bicycle|a vehicle with two wheels that you move by pushing pedals
 bridge|a structure that lets you cross over a river or road
 nest|a home built by a bird for its eggs`.trim().split('\n').map((line, i) => {
  const [word, meaning] = line.trim().split('|')
  return { id: `word-${i + 1}`, word, meaning, variety: 'shared', source: 'tuto-original', revision: 1 }
})
export const CLOZE = [
 ['We eat soup with a ___.','spoon','sock','kite'],
 ['Put your head on the pillow and sleep in the ___.','bed','pan','boat'],
 ['The ___ shows that it is three o’clock.','clock','brush','plate'],
 ['We cross the river on the ___.','bridge','roof','cloud'],
 ['The bird lays eggs in its ___.','nest','shoe','cup'],
 ['Wash your hands with water and ___.','soap','sand','cheese'],
 ['The ___ has tracks to travel on.','train','fish','horse'],
 ['I dry my wet hands with a ___.','towel','fork','rock'],
 ['The ___ makes honey.','bee','frog','pig'],
 ['We need a ___ to unlock this door.','key','leaf','drum'],
 ['I measure the line with a ___.','ruler','bell','hat'],
 ['The ___ has eight legs.','spider','rabbit','duck'],
 ['The ___ is full of pages to read.','book','bowl','coat'],
 ['We fly a ___ on a long string.','kite','carrot','table'],
 ['A ___ has a trunk and branches.','tree','river','ball'],
 ['The ___ is a fruit with a sour taste.','lemon','onion','potato'],
 ['We see with our ___.','eyes','ears','feet'],
 ['We hear with our ___.','ears','eyes','hands'],
 ['The ___ is a bird that can swim.','duck','goat','mouse'],
 ['I put my ___ on my head.','hat','sock','shoe'],
 ['The ___ is a white drink.','milk','rice','bread'],
 ['The ___ keeps rain out through the top of the house.','roof','floor','door'],
 ['I hit the ___ to make a beat.','drum','flower','egg'],
 ['The ___ has no legs and a long body.','snake','ant','hen'],
].map(([text, answer, ...wrong], i) => ({ id: `cloze-${i+1}`, text, answer, wrong }))

export const BE_FRAMES = [
 ['I','ready'],['I','at home'],['I','in the garden'],['I','happy'],
 ['You','kind'],['You','at the door'],['You','on the bus'],['You','early'],
 ['She','happy'],['He','ready'],['It','small'],['The cat','asleep'],
 ['The dog','wet'],['The bag','heavy'],['The book','open'],['The cup','empty'],
 ['We','ready'],['We','at home'],['They','happy'],['They','in the garden'],
 ['The cats','asleep'],['The dogs','wet'],['The books','open'],['The cups','empty'],
].map(([subject, predicate], i) => ({id:`be-${i+1}`, subject, predicate,
  person: subject === 'I' ? 'first' : 'other',
  number: ['You','We','They','The cats','The dogs','The books','The cups'].includes(subject) ? 'plural' : 'singular'}))

// Only unambiguous regular -s plurals in this first slice.
export const PLURAL_WORDS = ['cat','dog','bird','duck','hen','pig','goat','horse','rabbit','lion','tiger','bear','monkey','snake','frog','bee','ant','spider','apple','banana','lemon','grape','carrot','onion']

export const SENTENCES = [
 'The cat is on the bed.', 'The dog has a ball.', 'We sit under a tree.',
 'The bird is in its nest.', 'I have a red bag.', 'The book is on the table.',
 'The cup is empty.', 'The door is open.', 'The boat is on the lake.',
 'We can see the moon.', 'The rabbit eats a carrot.', 'I put on my coat.',
]
export const QUESTIONS = ['Where is the cat?', 'Who has the ball?', 'Is the door open?', 'Can you see the moon?', 'What is in the bag?', 'Where is my hat?']

export const PASSAGES = [
 {id:'seed', title:'A little seed', sentences:[
  'Mia puts a seed in a pot.', 'She adds water and puts the pot by the window.',
  'Each day, she checks the soil.', 'After a week, a green leaf appears.'],
  details:[['Where does Mia put the pot?','By the window.','Under the bed.','On a chair.',1],['What appears after a week?','A green leaf.','A red flower.','A yellow fruit.',3]],
  events:['Mia puts a seed in a pot.','Mia adds water.','A green leaf appears.']},
 {id:'kite', title:'The kite', sentences:[
  'Ben and Kim take a kite to the park.', 'Ben holds the string while Kim lifts the kite.',
  'The wind carries it up.', 'When the wind stops, they put the kite in a bag.'],
  details:[['Who holds the string?','Ben.','Kim.','Both children.',1],['Where do they put the kite at the end?','In a bag.','In a box.','In a tree.',3]],
  events:['The children take a kite to the park.','The wind carries the kite up.','The children put the kite in a bag.']},
 {id:'soup', title:'Soup for lunch', sentences:[
  'Sam washes a carrot and a potato.', 'Dad cuts them into small pieces.',
  'They cook the pieces in a pan with water.', 'At lunch, Sam eats the soup from a blue bowl.'],
  details:[['Who cuts the vegetables?','Dad.','Sam.','Sam and Dad together.',1],['What does Sam eat the soup from?','A blue bowl.','A white cup.','A red plate.',3]],
  events:['Sam washes the vegetables.','Dad cuts the vegetables.','Sam eats the soup.']},
 {id:'rain', title:'A rainy walk', sentences:[
  'Ali and Jo go for a walk.', 'Dark clouds fill the sky, and rain begins to fall.',
  'They wait under a shelter.', 'When the rain stops, they walk home together.'],
  details:[['Where do Ali and Jo wait?','Under a shelter.','Inside a shop.','Under a tree.',2],['When do they walk home?','When the rain stops.','Before the rain starts.','While the rain is falling.',3]],
  events:['Ali and Jo go for a walk.','They wait under a shelter.','They walk home.']},
 {id:'bridge', title:'A paper bridge', sentences:[
  'Lena puts two books on a table with a gap between them.', 'She lays a sheet of paper across the gap.',
  'A toy car makes the paper bend.', 'Lena folds a new sheet into a zigzag, and this time the paper holds the car.'],
  details:[['What makes the first sheet bend?','A toy car.','A toy boat.','A wooden block.',2],['How does Lena fold the new sheet?','Into a zigzag.','Into a tube.','Into a ball.',3]],
  events:['Lena puts two books on a table.','A toy car makes the paper bend.','Lena folds a new sheet.']},
 {id:'leaves', title:'Leaves on a tree', sentences:[
  'Many trees grow new leaves in spring.', 'Leaves use light from the sun to help the tree make food.',
  'In autumn, some trees lose their leaves.', 'New leaves grow again the next spring.'],
  details:[['What do leaves use to help the tree make food?','Light from the sun.','Light from the moon.','Sand from the beach.',1],['When do some trees lose their leaves?','In autumn.','In spring.','In summer.',2]],
  events:['New leaves grow in spring.','Some trees lose their leaves in autumn.','New leaves grow the next spring.']},
].map(p => ({ ...p, revision: 1, source: 'tuto-original', variety: 'shared' }))
