// Run from server/ directory:
//   node scripts/seedStoryIdeas.js

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const STORY_IDEAS = {
  '5-7': [
    { emoji: '🐉', title: 'Friendly dragon',      topic: 'A dragon afraid of fire makes an unlikely best friend.' },
    { emoji: '🐠', title: 'Flying fish',           topic: 'A fish who dreams of flying finally gets his wish.' },
    { emoji: '🐻', title: "Bear's big day",        topic: 'A bear cub sets off on his very first solo adventure.' },
    { emoji: '🐘', title: 'Tiny elephant',         topic: 'The smallest elephant in the herd turns out to be the bravest.' },
    { emoji: '🦋', title: 'Butterfly secret',      topic: 'A caterpillar is too scared to become a butterfly.' },
    { emoji: '🐸', title: 'Frog finds home',       topic: 'A frog whose pond dried up must find a brand-new home.' },
    { emoji: '🦁', title: 'Lion learns kindness',  topic: 'The loudest lion in the jungle discovers that being gentle is true strength.' },
    { emoji: '🐧', title: 'Penguin goes north',    topic: 'A penguin travels to the jungle and discovers it is not so different after all.' },
    { emoji: '🌈', title: 'Magic paintbrush',      topic: 'A paintbrush that brings every drawing to life causes wonderful chaos.' },
    { emoji: '🎩', title: 'Wishing hat',           topic: 'A hat that grants wishes but always gets them slightly wrong.' },
    { emoji: '🪄', title: 'Broken wand',           topic: 'A young wizard finds a wand that does the opposite of everything asked.' },
    { emoji: '🔑', title: 'Golden key',            topic: 'A golden key opens any door but always leads somewhere unexpected.' },
    { emoji: '📚', title: 'Book comes alive',      topic: 'Every story a child reads leaps right off the page into her bedroom.' },
    { emoji: '🧤', title: 'Candy gloves',          topic: 'A pair of gloves that turns anything you touch into candy.' },
    { emoji: '🌻', title: 'Sunflower friend',      topic: 'A lonely sunflower in the garden makes friends with a raindrop.' },
    { emoji: '🦄', title: 'Unicorn mystery',       topic: 'A unicorn who lost her horn learns that real magic comes from friendship.' },
    { emoji: '🐺', title: 'Wolf best friend',      topic: 'A wolf and a rabbit decide to become best friends despite what everyone says.' },
    { emoji: '👾', title: 'Monster next door',     topic: 'The new neighbor is a little monster who just wants someone to play with.' },
    { emoji: '🤝', title: 'New kid in town',       topic: 'Moving to a new town is scary until a talking squirrel shows you around.' },
    { emoji: '🚀', title: 'Candy planet trip',     topic: 'A rocket ship takes two kids to a planet made entirely of sweets.' },
    { emoji: '🏝️', title: 'Island treasure',      topic: 'Three friends follow a hand-drawn map to a tiny island treasure.' },
    { emoji: '🌋', title: 'Volcano city',          topic: 'A child discovers a magical city hidden inside a sleeping volcano.' },
    { emoji: '🎠', title: 'Runaway carousel',      topic: 'A merry-go-round horse jumps off and gallops deep into the forest.' },
    { emoji: '🛸', title: 'Backyard aliens',       topic: 'Two tiny aliens crash-land in a backyard and need help fixing their ship.' },
    { emoji: '🧭', title: 'Enchanted woods',       topic: 'A glowing trail leads a child deep into the enchanted forest.' },
    { emoji: '🍄', title: 'Mushroom village',      topic: 'A tiny village inside a mushroom is in danger of being stepped on.' },
    { emoji: '🍕', title: 'Pizza kingdom',         topic: 'A kingdom ruled by a pizza-obsessed queen suddenly runs out of cheese.' },
    { emoji: '🍦', title: 'Ice cream river',       topic: 'A river of melting ice cream threatens to flood the cookie castle.' },
    { emoji: '🍬', title: 'Candy forest',          topic: 'Every tree in the enchanted forest grows a different kind of candy.' },
    { emoji: '🎂', title: 'Cake runs away',        topic: 'A birthday cake gets up and walks away before anyone can eat it.' },
    { emoji: '⭐', title: 'Falling star',          topic: 'A little star falls from the sky and must find its way home before sunrise.' },
    { emoji: '🐛', title: 'Tiny hero',             topic: 'The tiniest caterpillar in the garden saves everyone from a hungry bird.' },
    { emoji: '🧸', title: 'Teddy saves night',     topic: 'A teddy bear comes alive at midnight to chase away bad dreams.' },
    { emoji: '🌙', title: 'Moon keeper',           topic: 'A child is chosen to keep the moon shining while its guardian sleeps.' },
    { emoji: '🐝', title: 'Brave little bee',      topic: 'A bee too small to carry pollen finds a way to save the whole hive.' },
    { emoji: '🌱', title: 'Tiny seed',             topic: 'A seed no one believed in grows into the most magical tree in the valley.' },
    { emoji: '🐭', title: 'Mouse big heart',       topic: 'The smallest mouse in the city has the biggest heart and saves the day.' },
    { emoji: '🌊', title: 'Wave rider',            topic: 'A child surfs a magical wave that carries her to the bottom of the ocean.' },
    { emoji: '🌸', title: 'Cherry blossom wish',   topic: 'Every petal that falls from the cherry tree grants one small wish.' },
    { emoji: '🧒', title: 'Kid fixes storm',       topic: 'After a big storm, a child rebuilds the neighborhood one act of kindness at a time.' },
  ],
  '8-10': [
    { emoji: '🗺️', title: 'Hidden map',           topic: 'A mysterious map in an old library leads to a buried secret.' },
    { emoji: '🕵️', title: 'Missing trophy',       topic: "The school's championship trophy vanishes the night before the big game." },
    { emoji: '🚪', title: 'Door thirteen',         topic: 'A hotel has no thirteenth floor — until one morning a new door appears.' },
    { emoji: '🖼️', title: 'Painting blinks',      topic: 'An old painting in the school hallway blinks when no one is watching.' },
    { emoji: '📷', title: 'Ghost in photo',        topic: 'Every photo taken in the old house shows a figure that should not be there.' },
    { emoji: '🔦', title: 'Midnight signal',       topic: 'A flashing light from an abandoned lighthouse starts sending coded messages.' },
    { emoji: '🧳', title: 'Lost suitcase',         topic: 'A suitcase left at the train station contains clues to a decades-old mystery.' },
    { emoji: '🔍', title: 'Stolen gems case',      topic: 'A kid detective is hired to find the stolen gems from the town museum.' },
    { emoji: '🐾', title: 'Paw print clues',       topic: 'Strange paw prints around the neighborhood lead to an unbelievable discovery.' },
    { emoji: '📝', title: 'Anonymous notes',       topic: 'Someone is leaving mysterious notes in lockers with clues to a hidden truth.' },
    { emoji: '🎪', title: 'Circus thief',          topic: 'Animals keep disappearing from the traveling circus and only one kid notices.' },
    { emoji: '🌆', title: 'Vanished city',         topic: 'A map shows an entire city that nobody living nearby has ever heard of.' },
    { emoji: '⏰', title: 'Medieval time slip',    topic: 'A broken clock sends a kid back to medieval times right before a great battle.' },
    { emoji: '📺', title: 'TV time portal',        topic: 'Pressing the wrong remote button sends a child into a black-and-white 1950s TV show.' },
    { emoji: '🪙', title: 'Ancient coin',          topic: 'A coin found in the park turns out to be a portal to ancient Rome.' },
    { emoji: '🔭', title: 'Telescope to past',     topic: 'A telescope that lets you see the past shows something that must be changed.' },
    { emoji: '📜', title: 'Letter from future',    topic: 'A letter arrives addressed to you from your future self with one urgent warning.' },
    { emoji: '🌊', title: 'Ocean breather',        topic: 'A girl discovers she can breathe underwater and finds a hidden civilization.' },
    { emoji: '🌡️', title: 'Weather changer',      topic: 'A girl realizes her emotions are literally changing the weather around her school.' },
    { emoji: '👁️', title: 'Truth seeker',         topic: 'A child who can always tell when someone is lying must use that power wisely.' },
    { emoji: '📡', title: 'Animal talker',         topic: 'After a lightning strike, a kid can suddenly understand every animal around him.' },
    { emoji: '🧲', title: 'Metal mover',           topic: 'A child discovers she can move metal with her mind but cannot control it yet.' },
    { emoji: '🦅', title: 'Feather glider',        topic: 'After touching a falcon feather, a boy can glide short distances through the air.' },
    { emoji: '🤖', title: 'Robot best friend',     topic: 'A robot built to be the perfect friend starts developing real feelings.' },
    { emoji: '🏰', title: 'Forgotten castle',      topic: 'Two rivals get trapped in an abandoned castle and must work together to escape.' },
    { emoji: '🦊', title: 'Honest fox',            topic: 'A fox who lies to get what he wants must learn honesty to save his friendships.' },
    { emoji: '🎭', title: 'Stage fright rivals',   topic: 'Best friends compete for the same lead role and risk breaking their bond.' },
    { emoji: '🏕️', title: 'Camp rivals',          topic: 'Two rival cabin teams discover their whole rivalry was based on a lie.' },
    { emoji: '🧪', title: 'Science fair feud',     topic: 'Former best friends competing in a science fair must team up when things go wrong.' },
    { emoji: '🐺', title: 'Wolf pack outcast',     topic: 'A wolf rejected by his pack must find a new place to belong in the wild.' },
    { emoji: '🦁', title: 'Lion fears dark',       topic: 'The bravest lion on the savanna has a secret — he is terrified of the dark.' },
    { emoji: '🐬', title: 'Dolphin lost at sea',   topic: 'A dolphin who swam too far from home must navigate back across the ocean.' },
    { emoji: '🐘', title: 'Elephant memory',       topic: 'An old elephant who remembers everything uses her memories to save the herd.' },
    { emoji: '🦓', title: 'Stripes mystery',       topic: 'A zebra born without stripes must prove she belongs in the herd.' },
    { emoji: '🐙', title: 'Octopus artist',        topic: 'An octopus who changes color for art rather than camouflage becomes a legend.' },
    { emoji: '🦜', title: 'Parrot keeps secret',   topic: 'A parrot who overheard a dangerous secret must decide whether to reveal it.' },
    { emoji: '🐊', title: 'Crocodile protector',   topic: 'A crocodile feared by everyone in the river turns out to be protecting them all.' },
    { emoji: '🦔', title: 'Hedgehog hero',         topic: 'A hedgehog who cannot hug anyone without hurting them finds a clever solution.' },
    { emoji: '🐼', title: 'Panda leaves home',     topic: 'A young panda leaves his bamboo forest in search of the world beyond the mountains.' },
    { emoji: '🦈', title: 'Gentle shark',          topic: 'The most feared shark in the ocean just wants to make friends but nobody will stay long enough.' },
  ],
  '11+': [
    { emoji: '📖', title: 'Books banned',          topic: 'In a world where reading is illegal, a teenager starts an underground library.' },
    { emoji: '🎭', title: 'Emotions monitored',    topic: 'In a society that monitors all feelings, a girl starts experiencing ones she cannot explain.' },
    { emoji: '🕐', title: 'Sunlight rationed',     topic: 'Citizens are only allowed four hours of sunlight per day and someone is stealing the rest.' },
    { emoji: '🤐', title: 'Silence law',           topic: 'A city where speaking is outlawed forces a teenage boy to find another way to fight back.' },
    { emoji: '🧠', title: 'Memory wipe',           topic: 'At sixteen, everyone gets their memories erased — except one girl who remembers everything.' },
    { emoji: '🔒', title: 'Walls that shrink',     topic: "A walled city's borders shrink by one meter every year and the government calls it progress." },
    { emoji: '🏷️', title: 'No names left',        topic: 'In a near-future world, everyone is assigned a number instead of a name at birth.' },
    { emoji: '💻', title: 'Trapped in game',       topic: 'Getting trapped inside a video game means the only way out is to finish it.' },
    { emoji: '🛸', title: 'First contact',         topic: 'A teenager intercepts an alien signal and must decide whether to respond.' },
    { emoji: '🌌', title: 'Parallel self',         topic: 'A school experiment opens a window to a parallel universe version of yourself.' },
    { emoji: '🤖', title: 'AI awakens',            topic: 'A teen discovers the AI she built for a school project has become truly conscious.' },
    { emoji: '🧬', title: 'Unedited',             topic: 'In a world where parents design children genetically, one unedited teen searches for identity.' },
    { emoji: '🌙', title: 'Moon born',             topic: 'A teenager born on the first moon colony has never stood on Earth and longs to go.' },
    { emoji: '⚡', title: 'Grid crash',            topic: 'When all technology fails permanently, a girl with old-world skills becomes essential.' },
    { emoji: '🪞', title: 'Mirror shows truth',    topic: 'A mirror in an antique shop shows the person you are supposed to become — and it is terrifying.' },
    { emoji: '🎭', title: 'Two versions',          topic: 'A teenager who plays a completely different character at school and at home must finally choose one.' },
    { emoji: '🧬', title: 'DNA surprise',          topic: 'A DNA test reveals you are not biologically related to either of your parents.' },
    { emoji: '🌐', title: 'Digital double',        topic: 'Your online persona becomes so famous that strangers start mistaking it for the real you.' },
    { emoji: '🧩', title: 'Missing piece',         topic: 'A puzzle found in a grandparent attic reveals the truth about who your family really is.' },
    { emoji: '🎒', title: 'Wrong life',            topic: "A mix-up at birth means two teenagers have been living each other's intended lives." },
    { emoji: '🏚️', title: "Grandmother's house",  topic: "Clearing out a grandmother's house after she passes reveals a secret life she never mentioned." },
    { emoji: '📷', title: 'Erased ancestor',       topic: 'A photograph found behind a wall shows a family member who was erased from history.' },
    { emoji: '🔮', title: 'Future vision',         topic: 'You start seeing the future in flashes and realize a family member has hidden the same ability.' },
    { emoji: '✉️', title: 'Unread letters',        topic: 'A box of unopened letters in the attic reveals your parents have been hiding a sibling.' },
    { emoji: '🗝️', title: 'Key to past',          topic: 'A key found in a grandfather clock opens a room that changes everything you knew.' },
    { emoji: '🕯️', title: 'Shadow lineage',       topic: 'Every generation of her family has been tasked with guarding a dangerous secret — now it is her turn.' },
    { emoji: '🏔️', title: 'Mountain awakens',     topic: 'An expedition reveals the mountain is a living organism responding to human damage.' },
    { emoji: '🌊', title: 'Sea reclaims city',     topic: 'A coastal city slowly sinking into the ocean has one teenager who refuses to leave.' },
    { emoji: '🌿', title: 'Forest fights back',    topic: 'A forest cut down for decades begins fighting back in ways no one can explain.' },
    { emoji: '🦠', title: 'Nature resets',         topic: 'A virus that only affects polluters spreads through the population and a teen must find its source.' },
    { emoji: '🐺', title: 'Too smart wolves',      topic: 'A rewilding project goes wrong when the reintroduced wolves seem smarter than wolves should be.' },
    { emoji: '☀️', title: 'Sun goes quiet',        topic: 'Solar activity drops, crops fail, and a teenager on a farm must find a new way to grow food.' },
    { emoji: '🌾', title: 'Last harvest',          topic: 'A girl protecting the last seed bank after a massive drought makes a choice that changes history.' },
    { emoji: '🎵', title: 'Sound controls minds',  topic: "A music app discovered to be altering memories without anyone's consent." },
    { emoji: '📱', title: 'App knows all',         topic: 'A new app predicts your every decision before you make it — and starts making them for you.' },
    { emoji: '👓', title: 'AR reality',            topic: 'AR glasses everyone wears begin showing a version of reality that slowly replaces the real one.' },
    { emoji: '🔋', title: 'Body battery',          topic: 'A new energy implant that powers devices from body heat begins changing the people who have it.' },
    { emoji: '🖥️', title: 'AI best friend',       topic: 'An AI friend designed to be perfect begins doing things its creator never programmed.' },
    { emoji: '📡', title: 'Deep space signal',     topic: 'A signal decoded by a teenage hacker contains instructions for a machine that should not exist.' },
    { emoji: '🌑', title: 'Shadow realm',          topic: 'A world where shadows live independent lives is discovered through a glitch in a surveillance system.' },
  ],
}

function normKey(topic) {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function buildRows() {
  const rows = []
  let dedupCount = 0

  for (const [age_band, ideas] of Object.entries(STORY_IDEAS)) {
    const seen = new Set()
    for (const { emoji, title, topic } of ideas) {
      const key = `${age_band}|${normKey(topic)}`
      if (seen.has(key)) {
        dedupCount++
        continue
      }
      seen.add(key)
      rows.push({ age_band, emoji, title, topic, scope: 'global', source: 'seed', status: 'active' })
    }
  }

  return { rows, dedupCount }
}

async function main() {
  const { rows, dedupCount } = buildRows()

  const { error: deleteError } = await supabase
    .from('story_ideas')
    .delete()
    .eq('source', 'seed')
    .eq('scope', 'global')

  if (deleteError) {
    console.error('Delete failed:', deleteError.message)
    process.exit(1)
  }

  const { error: insertError } = await supabase
    .from('story_ideas')
    .insert(rows)

  if (insertError) {
    console.error('Insert failed:', insertError.message)
    process.exit(1)
  }

  console.log(`Inserted: ${rows.length} rows | Deduped: ${dedupCount}`)
}

main()
