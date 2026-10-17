// Premise catalog for reading passages (E levels). A premise is a situation with something under it
// that a question can ask about: a hidden reason, a cause, a change. It is NOT a text and not a prompt
// from any book: each line below is our own abstract sentence. `source` records where the idea of the
// shape came from; "own" means written here. Books are read for the kind of situation they use, never
// copied (150 Totally Terrific Writing Prompts allows classroom photocopies only).
//
// Rules for adding one: no holidays or religious occasions (religion is out of the module, symmetric),
// nothing US- or UK-only (school year names, money, sports codes), no danger a child could copy at home,
// no romance, no death or illness of a person or pet. Animals may talk in fiction.

export const PREMISES = [
  { id: 'trade-for-friend', genre: 'fiction', theme: 'friends', source: '150 Writing Prompts p7 (shape only)',
    premise: 'A child offers to swap something valuable for something small, because they really want to make a new friend. The other child notices the real reason.' },
  { id: 'invention-fix', genre: 'fiction', theme: 'invention', source: '150 Writing Prompts p6 (shape only)',
    premise: 'A child builds a simple invention to solve a small problem at home. The first try goes wrong in a funny way, and a change makes it work.' },
  { id: 'dream-explained', genre: 'fiction', theme: 'dreams', source: '150 Writing Prompts cover (shape only)',
    premise: 'A child has a strange dream, and in the morning finds an ordinary reason for each odd part of it.' },
  { id: 'goal-new-term', genre: 'fiction', theme: 'school', source: '150 Writing Prompts p6 (shape only)',
    premise: 'A child sets one small goal for the new school term and finds a clever way to practise a little every day.' },
  { id: 'route-noticing', genre: 'fiction', theme: 'neighbourhood', source: '150 Writing Prompts p7 (shape only)',
    premise: 'On the walk to school a child notices one thing has changed, and works out why by the end of the day.' },
  { id: 'own-cartoon', genre: 'fiction', theme: 'creativity', source: '150 Writing Prompts p7 (shape only)',
    premise: 'A child invents a cartoon animal hero. The hero has one weakness that turns out to be useful.' },
  { id: 'lost-thing-trail', genre: 'fiction', theme: 'home', source: 'own',
    premise: 'Something goes missing at home. Small clues lead to a pet or a younger sibling who moved it for a harmless reason.' },
  { id: 'plant-experiment', genre: 'fiction', theme: 'nature', source: 'own',
    premise: 'Two children grow the same seeds in two places. One plant grows better, and they find out what made the difference.' },
  { id: 'rain-plan-change', genre: 'fiction', theme: 'weather', source: 'own',
    premise: 'An outdoor plan is spoiled by rain, so the children change the plan, and the new plan turns out better.' },
  { id: 'helping-neighbour', genre: 'fiction', theme: 'community', source: 'own',
    premise: 'A child helps an older neighbour with a small job and learns something surprising about the neighbour.' },
  { id: 'team-mistake', genre: 'fiction', theme: 'teamwork', source: 'own',
    premise: 'A class team makes a mistake in a project. Instead of blaming one person, they find what went wrong and fix it.' },
  { id: 'animal-shelter-trick', genre: 'fiction', theme: 'animals', source: 'own',
    premise: 'An animal finds a clever way to stay warm or dry, and a child works out how it did it.' },
  { id: 'shy-to-brave', genre: 'fiction', theme: 'feelings', source: 'own',
    premise: 'A child is nervous about doing something in front of others. A small idea helps, and the child feels proud.' },
  { id: 'recipe-swap', genre: 'everyday', theme: 'food', source: 'own',
    premise: 'A short set of steps to make a simple cold snack with no cooking and no knives, with one step that explains why it matters.' },
  { id: 'club-notice', genre: 'everyday', theme: 'school', source: 'own',
    premise: 'A notice about a school club: what it is, when it meets, what to bring, and one rule with its reason.' },
  { id: 'invitation', genre: 'everyday', theme: 'friends', source: 'own',
    premise: 'An invitation to a picnic or a games afternoon (not a holiday or religious event) with what to bring and a change of plan if it rains.' },
  { id: 'animal-fact', genre: 'information', theme: 'animals', source: 'own',
    premise: 'A short information text about how one well-known animal finds food or stays safe, with one cause and its effect. Facts must be true and simple.' },
  { id: 'weather-fact', genre: 'information', theme: 'science', source: 'own',
    premise: 'A short information text explaining one everyday weather thing (why puddles dry, why we see our breath on cold days). Facts must be true.' },
  { id: 'material-fact', genre: 'information', theme: 'science', source: 'own',
    premise: 'A short information text about why one material is used for one job (why umbrellas are not paper, why boots are rubber). Facts must be true.' },
  { id: 'paper-bridge', genre: 'fiction', theme: 'science', source: 'own',
    premise: 'Children try to make a paper bridge hold a small toy. It bends until they fold the paper, and they see why folding helps.' },
]
