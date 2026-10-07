// Birchwood House — content: the cast, the chores, the event templates and the lines people say.
// Pure data, no DOM and no three.js, so the rules (and their tests) can run in Node.
//
// Everyone in the house is an adult (18+) who came in of their own accord, knowing what the house is
// for and what happens in it. `{Title}` is whatever the player asked to be called; the player is
// otherwise only ever "you".
(function (root) {
'use strict';

const STATS = ['wil', 'att', 'res', 'sat', 'val', 'com'];
const STAT_NAMES = { wil: 'Wilfulness', att: 'Attention', res: 'Resentment', sat: 'Satisfaction', val: 'Valued', com: 'Composure' };
const STAT_HINTS = {
  wil: 'defiance; the higher it is, the firmer a hand it takes',
  att: 'how well the work gets done',
  res: 'grievance; escalation risk',
  sat: 'day-to-day contentment; low means acting out',
  val: 'trust that a correction comes from care',
  com: 'whether a lesson lands and lasts',
};

// ── The cast ────────────────────────────────────────────────────
// base: starting spread (the spread a returning resident, or one who used the word, is reset to).
// grad: what must hold, all at once, for them to move on. Never shown to the player.
// pain: how they take correction (the engine's tolerance / resilience, 0–1).
// traits: how the rules bend for them (see rules.js changeStat).
// bias: multipliers on the event categories they drift toward.
const CHARACTERS = {
  red: {
    id: 'red', name: 'Red', age: 22, pronouns: ['she', 'her', 'her', 'herself'],
    tagline: 'Never met the wolf.',
    story: 'Nobody told Red about the wood, so nobody told her about the wolf. She kept to the path, got to her grandmother\'s in good time, and learned nothing from it at all except that the world is mostly flowers. She has been distracted and impulsive and cheerfully unhurt ever since, and at twenty-two the grown-up world of rent and deadlines has run out of patience with her. She read the house rules twice, signed beneath the word, and walked in on her own feet.',
    base: { wil: 4, att: 2, res: 1, sat: 4, val: 3, com: 2 },
    grad: [['wil', '<=', 2], ['res', '<=', 1], ['val', '>=', 5], ['com', '>=', 4]],
    pain: { tolerance: 0.4, resilience: 0.5 },
    traits: [],
    note: 'Needs to trust you before the behaviour follows. Over-correction reads as being sent away, not as discipline.',
    bias: {},
    lines: {
      open: ['"Is this going to take long, {Title}? Only I had a thought about the hens."', '"Right. Yes. I\'m listening. I\'m mostly listening."'],
      arrive: '"Hello! I\'m Red. I\'m not actually sure how I got here, but I read the rules, and I mean them."',
      leave: '"I stayed on the path the whole way, {Title}. Look — I didn\'t even stop for the flowers."',
    },
  },
  goldilocks: {
    id: 'goldilocks', name: 'Goldilocks', age: 24, pronouns: ['she', 'her', 'her', 'herself'],
    tagline: 'Nobody ever came home.',
    story: 'The bears never came back early. Goldilocks ate the porridge, tried the chairs, broke one, slept in the smallest bed, and woke to find the house just as she had left it — nothing changed, nobody cross, no one to say it had mattered. She has been trying other people\'s houses ever since and finding fault with each of them. She came to Birchwood House to see whether anywhere had a rule she could not talk her way around, and she knows what it costs to find out.',
    base: { wil: 4, att: 3, res: 2, sat: 4, val: 2, com: 1 },
    grad: [['wil', '<=', 3], ['att', '>=', 4], ['val', '>=', 4]],
    pain: { tolerance: 0.5, resilience: 0.5 },
    traits: [],
    note: 'Entitled rather than malicious. Needs consistency, not softness; a reprieve early on reads as no consequence at all.',
    bias: { boundary: 1.3 },
    lines: {
      open: ['"Fine. But I\'ll say now that the chair isn\'t right."', '"Go on, then, {Title}. Let\'s see if this one\'s just right."'],
      arrive: '"I\'ve tried a lot of places. This is the first one that wrote its rules down first."',
      leave: '"It was just right, {Title}. Don\'t let anyone move the chairs."',
    },
  },
  rapunzel: {
    id: 'rapunzel', name: 'Rapunzel', age: 26, pronouns: ['she', 'her', 'her', 'herself'],
    tagline: 'The prince never came.',
    story: 'No prince ever climbed the tower, so Rapunzel cut her own hair and left it, and then she kept leaving: from one kind stranger to the next, into one unsafe room after another, because nobody had ever taught her how a person looks after herself. She looks nearly finished and is nothing of the kind. She came to Birchwood House having decided, for once, to ask for something.',
    base: { wil: 2, att: 5, res: 4, sat: 2, val: 1, com: 3 },
    grad: [['val', '>=', 5]],
    pain: { tolerance: 0.35, resilience: 0.35 },
    traits: [],
    note: 'A trap: low Wilfulness hides high Resentment. Looks nearly done, isn\'t. Nothing clears her but being valued.',
    bias: { neglect: 2.5 },
    lines: {
      open: ['"I\'ll do whatever you think is right, {Title}." (It is not an answer. She knows it is not an answer.)', '"You don\'t have to be gentle, {Title}. I\'d just like it to count."'],
      arrive: '"I\'m Rapunzel. I\'m — I\'ve been told I\'m very good at being no trouble."',
      leave: '"Nobody climbed up, {Title}. I walked down. I think that was the point all along."',
    },
  },
  jack: {
    id: 'jack', name: 'Jack', age: 28, pronouns: ['he', 'him', 'his', 'himself'],
    tagline: 'It always worked out.',
    story: 'Jack climbed the beanstalk, robbed the giant and got away down the stalk with a goose and a harp, and learned from it that bravado and a quick tongue will get him out of anything. They always have. Nobody ever made the bill come due. At twenty-eight the exits are closing, and he has noticed, and would like to know what happens when they all close at once. He asked to come here, grinning, and then asked what the rules were.',
    base: { wil: 6, att: 3, res: 1, sat: 5, val: 4, com: 2 },
    grad: [['wil', '<=', 3]],
    pain: { tolerance: 0.7, resilience: 0.65 },
    traits: [{ stat: 'res', factor: 0, sources: ['overshoot1'], when: { val: ['>=', 4] } }],
    note: 'High Wilfulness, low Resentment: defiance is appetite, not grievance. Takes a firm hand well so long as he still feels valued.',
    bias: { petty: 1.3, boundary: 1.2 },
    lines: {
      open: ['"Go on then, {Title}. Bet I can take it without making a sound."', '"Sure. Why not. What\'s the worst that can happen? — no, don\'t answer that."'],
      arrive: '"Jack. Sometimes the Giant-Killer, but mostly just Jack. Have you got any beans? No? Pity."',
      leave: '"First time I\'ve ever climbed down on purpose, {Title}. Funny. The view\'s better."',
    },
  },
  hans: {
    id: 'hans', name: 'Hans', age: 27, pronouns: ['he', 'him', 'his', 'himself'],
    tagline: 'Never learned to shiver.',
    story: 'Hans went out into the world to learn what it was to shudder, and never did: not at the haunted castle, not at the gallows, not at anything. There was no moral at the end of it, only a boy who could not feel the thing that tells everyone else to stop. He has been told all his life that he is brave. He would like, very much, to be told when he has gone too far, and has come here to be shown where that is.',
    base: { wil: 2, att: 4, res: 1, sat: 4, val: 3, com: 1 },
    grad: [['com', '>=', 6]],
    pain: { tolerance: 0.97, resilience: 0.9 },
    traits: [{ stat: 'wil', factor: 0.5, sources: ['correction'] }],
    note: 'Severity barely registers. Escalating on him only repeats the mistake his story is made of; he moves on aftercare and attention.',
    bias: {},
    lines: {
      open: ['"Whatever you think is needed, {Title}. I don\'t suppose I\'ll feel much, but do go on."', '"I\'ll tell you honestly if it does anything. It usually doesn\'t."'],
      arrive: '"Hans. Nothing frightens me, and I\'m told that is the problem."',
      leave: '"I shivered last night, {Title}. Just once. It was wonderful."',
    },
  },
  snow: {
    id: 'snow', name: 'Snow White', age: 25, pronouns: ['she', 'her', 'her', 'herself'],
    tagline: 'Rescued, again and again.',
    story: 'Nobody ever poisoned the apple, and nobody ever lifted a curse: the huntsman let her go, the dwarfs took her in, a hundred kind people kept her safe, and she learned only that someone else always decides. She says yes to whoever is kindest and has never had to find out what she wants. Her life since has been easy to move in any direction. She chose this house herself, and wrote that down for you before she would say anything else.',
    base: { wil: 1, att: 5, res: 1, sat: 2, val: 4, com: 2 },
    grad: [['com', '>=', 5], ['sat', '>=', 4]],
    pain: { tolerance: 0.3, resilience: 0.4 },
    traits: [{ stat: 'val', factor: 2 }, { stat: 'sat', factor: 0.5 }],
    note: 'The mirror of Rapunzel: too easy to move, in any direction. Compliance is not security. Needs consistency of source, not just warmth.',
    bias: { dishonest: 1.4 },
    lines: {
      open: ['"Yes, {Title}. Whatever you think. I\'ll be good."', '"I don\'t mind. Really. I never mind."'],
      arrive: '"I\'m Snow White. I\'m — I\'d like to learn to want things. If that\'s all right."',
      leave: '"I said no to someone today, {Title}. I said it and nothing happened. I wanted you to know."',
    },
  },
};
const ORDER = ['red', 'goldilocks', 'rapunzel', 'jack', 'hans', 'snow'];

// ── Chores ──────────────────────────────────────────────────────
// diff 1–3. `phrase` slots into sentences. Paired chores take two residents.
const CHORES = [
  { id: 'washing', name: 'Washing', phrase: 'the washing', diff: 1 },
  { id: 'sweeping', name: 'Sweeping', phrase: 'the sweeping', diff: 1 },
  { id: 'water', name: 'Fetching Water', phrase: 'the water-fetching', diff: 1 },
  { id: 'hens', plural: true, name: 'Feeding the Hens', phrase: 'the hens', diff: 1 },
  { id: 'mending', name: 'Mending', phrase: 'the mending', diff: 2 },
  { id: 'cooking', name: 'Cooking Supper', phrase: 'supper', diff: 2 },
  { id: 'floors', plural: true, name: 'Scrubbing the Floors', phrase: 'the floors', diff: 2 },
  { id: 'garden', name: 'Tending the Garden', phrase: 'the garden', diff: 2 },
  { id: 'preserving', name: 'Preserving', phrase: 'the preserving', diff: 3 },
  { id: 'hearth', name: 'Hearth Care', phrase: 'the hearth', diff: 3 },
  { id: 'laundry', plural: true, name: 'Laundry Line', phrase: 'the heavy linens', diff: 2, paired: true },
  { id: 'baking', name: 'Baking', phrase: 'the baking', diff: 2, paired: true },
  { id: 'furniture', name: 'Moving Furniture', phrase: 'the furniture', diff: 2, paired: true },
];

// What the Behaviour Card says about the day's chore, by outcome. {Name} {Subj} {Poss} {Chore} {Partner}
const CHORE_LINES = {
  well: [
    '{Name} did {Chore} so thoroughly it was a pleasure to look at. {Subj} even hummed through it.',
    '{Name} finished {Chore} early, and then went looking for something else to put right.',
    '{Chore} {was} done beautifully today. {Name} wouldn\'t take the credit, but {Subj} stood a little straighter for it.',
    'By midday {Chore} {was} finished and {Name} was looking round for more, which no one could remember happening before.',
  ],
  completed: [
    '{Name} did {Chore}, start to finish, without being asked twice.',
    '{Name} saw {Chore} through. Nothing remarkable, nothing wrong.',
    '{Chore} {was} done, steadily and quietly, and {Name} went about {it} without complaint.',
    '{Name} got on with {Chore} and finished {it} before supper, with no fuss and no shortcuts.',
  ],
  partial: [
    '{Name} got most of {Chore} done and left the rest "for later", which is not a time.',
    '{Name} started {Chore} well and drifted. Half of {it} {is} finished and half of {it} {is} a good intention.',
    '{Chore} {was} done, after a fashion. There are corners {Name} is hoping nobody checks.',
    '{Name} did a fair part of {Chore}, and then found something much more interesting to be doing.',
  ],
  failed: [
    '{Name} made a real mess of {Chore}. {It} will have to be done again, by someone, and {Subj} knows it.',
    '{Chore} did not get done. {Name} has a very detailed explanation, and it has no end.',
    '{Name} abandoned {Chore} halfway and was found elsewhere, looking out of a window.',
    '{Name} was given {Chore} to see to and, by evening, had very little to show for it but a long story about why.',
  ],
};
// A shared chore with nobody to share it: it cannot be done.
const ALONE_LINES = [
  '{Name} went to do {Chore} and found it was a job for two. {Subj} stood about with it for a while, and nothing got done.',
  '{Chore} {is} no use to one pair of hands. {Name} tried it anyway, and by evening had little to show for it.',
  '{Name} looked at {Chore}, looked round for someone to help, and found no one. It was left as it was.',
];
const PAIR_LINES = {
  well: ['{Name} and {Partner} did {Chore} together as if they had done it all their lives.', '{Name} and {Partner} found a rhythm over {Chore} and kept it all afternoon.'],
  completed: ['{Name} and {Partner} saw {Chore} through between them, with only a little muttering.', '{Name} and {Partner} did {Chore} side by side, and said hardly a word, which in this house is a kind of peace.'],
  partial: ['{Name} and {Partner} got most of {Chore} done, and each privately believes the other one left the rest.', '{Name} and {Partner} began {Chore} together and finished it separately, or nearly.'],
  failed: ['{Name} and {Partner} made a tangle of {Chore} between them, and neither will say whose fault it was.', '{Name} and {Partner} could not agree how to do {Chore}, and so did not.'],
};

// ── Events ──────────────────────────────────────────────────────
// {Name} {Subj} {Poss} {Obj} {Refl} {Second} {Title}. Pronouns that start a sentence capitalise themselves.
// `trap`: the gentle answer is the right one; a correction counts as an overshoot, and a kind word pays extra.
const EVENTS = {
  // A setback undoes some of what has been gained (`fx`: [stat, change] pairs, always at least Attention or Composure or Valued down, or Wilfulness up).
  setback: [
    { text: '{Name} had a bad night, and a bad morning after it. Whatever was getting steadier has gone back to being loose, and {Subj} will not say why.', fx: [['com', -1], ['att', -1]] },
    { text: 'A letter came for {Name} from the old life, and {Subj} read it three times by the fire. {Subj} has been somewhere else all day.', fx: [['att', -1], ['val', -1]] },
    { text: '{Name} was doing so well that someone said so, and {Subj} promptly went and did the opposite, as if to check it was still allowed.', fx: [['wil', 1], ['att', -1]] },
    { text: 'A traveller on the road told {Name} what the house was "really" for, and {Subj} has been quietly doubting it ever since.', fx: [['val', -1], ['wil', 1]] },
    { text: 'The old habits came back to {Name} all at once this afternoon, the way they do. {Subj} caught them too late.', fx: [['com', -1], ['wil', 1]] },
    { text: '{Name} woke at the hour {Subj} used to wake in the old life, and spent the whole of the day in that mood.', fx: [['sat', -1], ['com', -1]] },
    { text: 'The weather turned, the fire smoked, and {Name} took all of it personally. Two weeks of good work went out of the window with the smoke.', fx: [['att', -1], ['sat', -1]] },
    { text: '{Name} found something of {Poss} own in a drawer, from before, and could not put it down. Nothing else got done.', fx: [['att', -1], ['com', -1]] },
  ],
  petty: [
    '{Name} put a frog in someone\'s shoe. {Subj} isn\'t saying whose. {Subj} is very pleased about it.',
    '{Name} "lost" the mending needle rather than finish {Poss} sewing. It was in {Poss} pocket the whole time.',
    '{Name} ate the last of the honey cake that was meant to be shared, and left the crumbs as the only evidence.',
    '{Name} swapped the salt and the sugar in the kitchen jars, just to see what would happen at breakfast.',
    '{Name} was asked to fetch water twice. Both times {Subj} came back with a very good reason why {Subj} hadn\'t.',
    '{Name} hid under the stairs during chore assignment and let everyone assume {Subj} had already left for the well.',
    '{Name} drew a face on the fogged-up window and left it there for {Poss} own amusement.',
    '{Name} answered every single question at supper with a riddle instead of an answer, and thought it was very funny.',
    '{Name} "accidentally" let the cat into the pantry. There is now cat in the butter.',
    '{Name} rearranged everyone\'s boots by the door, left to right, just to watch the confusion.',
    { only: 'red', text: '{Name} went to fetch the water and came back an hour later with a basket of flowers and no water. {Subj} had only been looking.' },
    { only: 'goldilocks', text: '{Name} tried every chair in the parlour before sitting, found fault with all of them, and ended up on the stairs.' },
    { only: 'jack', text: '{Name} traded the good kettle to a pedlar for "a handful of very promising beans" and is certain it will come out well.' },
    { only: 'hans', text: '{Name} was told a ghost story at the fire and asked, politely, whether it was meant to be frightening.' },
  ],
  boundary: [
    '{Name} was told not to go past the garden wall. {Subj} went anyway, and came back with berries picked past it, sweetly, as if that settled it.',
    '{Name} was asked not to touch the good dress. {Subj} wore it anyway, for "just a minute", which became most of the afternoon.',
    '{Name} was told to be in before dusk. {Subj} came back well after dark, unbothered, whistling.',
    '{Name} was asked to knock before entering. {Subj} didn\'t. Twice.',
    '{Name} was told the top shelf was not to be climbed for. {Subj} climbed for it anyway and knocked half of it down.',
    '{Name} was asked to wait to be excused from the table. {Subj} got up halfway through and simply left.',
    '{Name} was told the second helping was for after chores were done. {Subj} took it first and did the chores after, if at all.',
    '{Name} was asked not to wander past the tree line alone. {Subj} did, and came back with leaves in {Poss} hair and no apology in mind.',
    { only: 'red', text: '{Name} was told to stay on the path to the well. {Subj} found four other paths and took the one with the most interesting noise at the end.' },
    { only: 'goldilocks', text: '{Name} slept in the guest room that was shut up for the season. "It was just right," {Subj} said, as though that settled it.' },
    { only: 'rapunzel', text: '{Name} said yes to a stranger at the gate who asked to be let in for the night, without asking anyone first.' },
    { only: 'jack', text: '{Name} climbed onto the roof to see what could be seen. {Subj} saw quite a lot, and has been telling it to anyone who\'ll listen.' },
    { only: 'hans', text: '{Name} slept in the cold cellar on purpose, to see whether it would make {Obj} shiver. It did not.' },
    { only: 'snow', text: '{Name} took an apple from a woman at the gate without asking where it came from, and has been in a very good mood about it since.' },
  ],
  friction: [
    '{Name} took {Second}\'s comb without asking, and broke it. {Subj} hasn\'t said anything about it.',
    '{Name} snapped at {Second} over nothing at supper. Later {Subj} wouldn\'t say why.',
    '{Name} and {Second} haven\'t spoken since yesterday. Neither will explain what happened.',
    '{Name} took the last of the warm water before {Second} could have a turn, and didn\'t seem to notice or care.',
    '{Name} said something sharp to {Second} in front of everyone. {Second} went quiet for the rest of the evening.',
    '{Name} blamed {Second} for a chore {Subj} hadn\'t finished {Refl}. {Second} didn\'t argue, but didn\'t forget it either.',
    '{Name} wouldn\'t sit near {Second} at supper, and moved {Poss} chair rather loudly to make the point.',
    '{Name} read something of {Second}\'s that wasn\'t meant to be read, and won\'t say what it was.',
  ],
  dishonest: [
    '{Name} told two different stories about where the missing coin went, and neither one quite matched.',
    { trap: true, text: '{Name} said {Subj} was fine. {Subj} was not fine: {Subj}\'d been crying in the stairwell for the better part of an hour.' },
    '{Name} claimed {Subj} hadn\'t heard the call for supper. {Subj} was standing close enough to have heard it twice.',
    { trap: true, text: '{Name} has been quietly slipping food into {Poss} pocket at meals, and won\'t say why, or where it\'s going.' },
    '{Name} said the broken jug wasn\'t {Poss} doing. The evidence rather strongly suggests otherwise.',
    { trap: true, text: '{Name} has been saying {Subj}\'s sleeping fine. {Subj} is not sleeping fine. The candle in {Poss} room burns very late.' },
    { only: 'jack', text: '{Name} told a tale at supper of how {Subj} talked {Poss} way out of a debt. Most of it was true. Not the part about the debt.' },
    { only: 'rapunzel', trap: true, text: '{Name} gave away {Poss} supper to a passing pedlar at the gate, and told everyone {Subj} had eaten it.' },
    { only: 'snow', text: '{Name} said yes to everything asked of {Obj} today, including two things that contradicted each other.' },
  ],
  neglect: [
    '{Name} hasn\'t touched {Poss} supper in two days. When asked, {Subj} just shrugged.',
    '{Name} has stopped singing at {Poss} chores. {Subj} used to sing at everything.',
    '{Name} keeps the door of {Poss} room shut, even in daylight.',
    '{Name} sat apart from everyone at breakfast again this morning, and left before anyone could ask why.',
    '{Name} hasn\'t laughed in several days, not even at things that would usually get one out of {Obj}.',
    '{Name} has been going to bed before the candles are even lit, and rising after everyone else has already started the day.',
    '{Name} flinched when {Subj} thought no one was looking, over something entirely ordinary.',
    '{Name} has stopped asking questions. {Subj} used to ask about everything.',
    { only: 'rapunzel', text: '{Name} has taken to sitting at the high window in the evenings, looking down the road, and won\'t say what {Subj} is watching for.' },
    { only: 'hans', text: '{Name} has stopped coming to the fire in the evenings. {Subj} says {Subj} doesn\'t mind the cold. That is rather the trouble.' },
    { only: 'snow', text: '{Name} ate whatever was put in front of {Obj} without looking at it, and thanked the person who put it there for the trouble.' },
  ],
  cruelty: [
    '{Name} told {Second} that nobody would miss {Obj} if {Subj} left. {Subj} said it to be cruel, and knew it.',
    '{Name} mocked {Second} for still being frightened of the dark. {Second} didn\'t answer, and went quiet for the rest of the evening.',
    '{Name} took something small of {Second}\'s and broke it in front of {Obj}, on purpose, to see {Poss} face fall.',
    '{Name} repeated something {Second} had told {Obj} in confidence, loudly, in front of the others.',
    '{Name} laughed when {Second} made a mistake at chores, and made sure {Second} knew {Subj}\'d seen it.',
  ],
};
// Base share, situational modifier on the correction, and the on-reveal stat effects (see rules.js).
const CATEGORIES = {
  petty:     { label: 'Mischief',            share: 30, mod: 0 },
  boundary:  { label: 'Boundary-testing',    share: 20, mod: 1 },
  friction:  { label: 'Friction',            share: 20, mod: 1, needsSecond: true },
  dishonest: { label: 'Concealment',         share: 15, mod: 1 },
  neglect:   { label: 'Withdrawal',          share: 10, mod: 0 },
  cruelty:   { label: 'A small cruelty',     share: 5,  mod: 2, needsSecond: true },
  setback:   { label: 'A setback',           share: 16, mod: 1 },   // progress undone: likelier the more they have to lose
};

// ── Reprieves and aftercare ─────────────────────────────────────
// A reprieve replaces the correction for the evening; aftercare comes after one. `cost` is spent from the
// evening's candle (see rules.js EVENING_CANDLE). Effects are in rules.js.
const REPRIEVES = {
  stern:      { name: 'A Stern Word',       cost: 2, blurb: 'Say it plainly and send them off. Wilfulness down a little.' },
  kind:       { name: 'A Kind Word',        cost: 2, blurb: 'Sit with them and listen. Valued and Satisfaction up.' },
  reflection: { name: 'Written Reflection', cost: 2, blurb: 'Pen and paper; think it through. Composure up, Wilfulness down a little.' },
};
const AFTERCARE = {
  corner: { name: 'Corner Time', cost: 1, blurb: 'A few quiet minutes facing the wall. Composure up; if they feel unvalued it stings instead.' },
  lines:  { name: 'Lines',       cost: 1, blurb: 'Careful, attentive work. Composure and Attention up, no downside.' },
  held:   { name: 'Held After',  cost: 2, blurb: 'You stay with them until it eases. Valued up, Resentment down.' },
  warm:   { name: 'Warm Words',  cost: 1, blurb: 'Something kind, once it is over. Valued and Satisfaction up.' },
};

// ── Things people say. {Title} {Name} ───────────────────────────
const SAYINGS = {
  well:    ['"Yes, {Title}. I understand."', '"…Thank you, {Title}. I needed that."', '"That was fair. I know it was."'],
  under:   ['"Is that all, {Title}?"', '"Oh. Is that — are we done?"', '"I\'d braced for more, {Title}."'],
  over:    ['"That was… more than I needed, {Title}."', '"I\'d have listened with less, {Title}."', '"It\'s over. Please can it be over."'],
  harsh:   ['"Stop — please, {Title}. Please."'],
  word:    ['"{Title}. Red. I\'m calling it."'],
  nothing: ['"…Oh. All right, {Title}."'],
};

// ── Moving them about the room. {Name} {Subj} {Obj} {Poss} {Impl} ─
const MOVES = {
  leaving: {
    calm: 'You step back and let {Name} straighten up.',
    sore: '{Name} straightens up slowly, rubbing the sting out with the heel of a hand.',
    spent: '{Name} comes up shakily, and you keep a hand on {Poss} arm until {Subj} is steady.',
  },
  to: {
    lap: 'You sit, and pat your knee. {Name} crosses to you and lets you draw {Obj} down across your lap.',
    case: 'You steer {Name} to the table. {Subj} bends at the hips and lays {Poss} palms flat on the boards.',
    head: 'You stand {Name} in the middle of the room and tell {Obj} to put {Poss} hands on {Poss} head, fingers laced.',
    chair: 'You pull your chair out and set it square in front of {Name}. {Subj} bends forward and takes hold of the seat.',
    spread: 'You nudge {Name}\'s feet apart with your own and wait while {Subj} settles, bent forward, palms on {Poss} thighs.',
  },
  fetched: '{Name} comes back with the {Impl}, hands it over, and takes {Poss} place again.',
  setdown: 'You set the {Impl} aside and rest your hand on {Name}\'s back.',
};

// ── Scenes: the goodbyes ─────────────────────────────────────────
// Each is a few beats shown over the room with the resident standing in it. A beat is narration (`n`), the resident speaking (`r`),
// or a choice for the player (`ask`): each option has what you say (`you`) and the resident's answer (`r`). Nothing in either scene
// lets the player talk anyone out of leaving: the word is honoured, and moving on is the end of a good story. {Title} {Name} {Subj} {Obj} {Poss}
const SCENES = {
  moveon: {
    open: [
      { n: '{Name} is waiting by the door with a bundle over {Poss} shoulder, and has been for some time. The house is very quiet.' },
    ],
    // per resident: what they say first, three answers to what you say, and the last image
    red: {
      r: '"I\'ve been trying to think of something clever to say, {Title}, and every time I get distracted by the hens."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you. You know that."', r: '"I stayed on the path the whole way here, you know. Mostly. There was one very good flower."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Go straight to Grandmother\'s. No — I\'ll go straight there, then stop for flowers on the way back. That\'s allowed, isn\'t it? Stopping on the way back?"' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"Oh. Yes. Thank you." {Subj} laughs, a bit wetly. "I\'m not going to cry. Look at me not crying."' },
      ],
      end: '{Name} goes down the path without looking back, which is new, and which {Subj} will tell everyone about for years.',
    },
    goldilocks: {
      r: '"I tried every chair in this house, {Title}. Do you know, I never once wanted to find fault with yours."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you."', r: '"Don\'t. I\'ll want to stay, and then I\'ll start finding fault with the porridge."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Knock. First time in my life I intend to knock, and wait to be asked in."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"Well. It\'s just right, {Title}. It always was."' },
      ],
      end: '{Name} knocks on the doorframe on the way out, once, as if to say it was never trespass.',
    },
    rapunzel: {
      r: '"Nobody climbed up, {Title}. I want that said, in case it ever matters: I walked down myself."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you."', r: '"I think I believe you. That\'s the strange part. I think I actually believe you."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Eat a proper meal, at a proper table, and not give half of it to whoever happens to ask."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"The road looks different when you\'ve decided to be on it."' },
      ],
      end: '{Name} stops once at the gate, and looks up at the highest window, and then keeps walking.',
    },
    jack: {
      r: '"I had a speech, {Title}. It was a good one. All about how I\'d been a fool and a legend at the same time."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you."', r: '"Don\'t say that, you\'ll ruin my reputation. — No. Say it again. Slower."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Pay back every bean I ever owed. Then, I don\'t know. Climb something. Come down again, on purpose."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"No quip. See? Growth." {Subj} grins, and means it differently than {Subj} used to.' },
      ],
      end: '{Name} whistles all the way to the road, and stops whistling when {Subj} thinks no one can hear, and just walks.',
    },
    hans: {
      r: '"I\'m told this is where I\'m supposed to feel something, {Title}. I do, as it happens. I think it might be the shivers."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you."', r: '"Say it again. I want to feel it go down my back."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Sit by a fire and notice that I\'m cold. That\'s the plan. It sounds small. I\'ve wanted it all my life."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"The air\'s sharp." {Subj} breathes it in. "Look at that. Gooseflesh."' },
      ],
      end: '{Name} pulls {Poss} collar up against the morning, and smiles at being cold, and goes.',
    },
    snow: {
      r: '"I wrote down what I want, {Title}. Three things. I\'ve never had three things before."',
      ask: [
        { label: 'Tell them you are proud of them', you: '"I\'m proud of you."', r: '"I don\'t need you to say it for me to know it. But thank you. I\'d like to hear it anyway."' },
        { label: 'Ask what they will do first', you: '"What will you do first?"', r: '"Say no to something small. A cake, perhaps. And then, if it goes well, something bigger."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"I\'m choosing to go. Nobody\'s told me to. That feels — I\'ll tell you how it feels when I\'m further down the road."' },
      ],
      end: '{Name} walks out with {Poss} head up, not waiting for anyone to say that it is all right.',
    },
  },
  // The safe word ("Red"), used for the last time. Whatever you say, it is honoured; the options only colour the farewell.
  word: {
    why: {
      harsh: '{Name} has stopped, and is standing up out of position. {Subj} is trembling a little, and perfectly clear.',
      worn: 'In the grey of the morning {Name} is standing at the foot of the stairs, with {Poss} bundle already packed. It is not a decision made in a hurry.',
    },
    r: '"{Title}. Red. I\'m calling it."',
    n: 'It stops, entirely, the way it was always going to.',
    ask: [
      { label: 'Thank them for telling you', you: '"Thank you for telling me. Of course. It\'s done."', r: { willing: '"Thank you for stopping. I mean it."', sullen: '"…Thank you. I wasn\'t sure you would."', cheeky: '"Good. I wasn\'t sure how I\'d say it twice."', flustered: '"Thank you — thank you. I\'m sorry, I\'m not — thank you."', plain: '"Thank you. That\'s all I needed."' } },
      { label: 'Ask if they need anything before they go', you: '"Is there anything you need before you go? Anything at all."', r: { willing: '"A glass of water, if it\'s no trouble. And ten minutes on my own."', sullen: '"Nothing. Just the door, please."', cheeky: '"My boots. And a bit of quiet, which I know isn\'t like me."', flustered: '"Somewhere to sit. For a minute. Then I\'ll go."', plain: '"A moment on my own, and my coat."' } },
      { label: 'Step back and open the door', you: '(You step back, and open the door for them.)', r: { willing: '"…Thank you, {Title}."', sullen: '{Subj} goes through it without a word, which is its own kind of answer.', cheeky: '"Nice manners." It\'s not quite a joke.', flustered: '{Subj} nods, over and over, and cannot seem to stop.', plain: '{Subj} nods once, and goes.' } },
    ],
    end: {
      red: '{Name} goes out into the lane, and for once does not stop to look at a single flower.',
      goldilocks: '{Name} leaves the chair exactly where it was. That, at least, is new.',
      rapunzel: '{Name} takes {Poss} bundle and goes, and nobody follows. That is rather the point.',
      jack: '{Name} does not look back and does not whistle, and is gone down the road before the door has closed.',
      hans: '{Name} goes out into the cold, and this time seems to feel it.',
      snow: '{Name} goes without asking anyone whether it is all right to. It is, and nobody holds it against {Obj}.',
    },
    last: 'Nothing is held against them, or written down. The house keeps no grudge; if it ever takes them in again, it will be as if they had never gone.',
  },
};

// ── Morning narration ───────────────────────────────────────────
// A few sentences at the top of the morning: the weather in the house, one resident caught in the act of being themselves, and what wants doing.
const MORNING = {
  first: ['The door of Birchwood House is open, the fire has been lit, and the kettle is making the small anxious noises of a kettle that has never yet been asked to do anything. Today, at last, the house has people in it.'],
  weather: [
    'Mist lies in the lane and the hens complain about it from under the hedge. The kitchen smells of woodsmoke and yesterday\'s bread.',
    'The sun gets in through the shutters in long gold bars, and every one of them has dust dancing in it. It is going to be a warm, sticky sort of day.',
    'Rain on the thatch since before dawn. The whole house has gone quiet and a little damp, and the cat has taken the best chair.',
    'A hard bright frost has put white on every fencepost, and the water in the pail has a skin of ice that someone will have to break.',
    'There is a wind getting up. The shutters knock, the chimney hums, and a loose slate somewhere is keeping time.',
    'The morning is grey, soft and slow. The sort of light that makes everything look as if it has been washed and not yet put away.',
    'Birds have been at it since four. The garden is loud and green and badly in need of attention.',
    'Somebody has left the back door open overnight and the whole kitchen is full of cold air and one very confident sparrow.',
    'The stairs creak in their usual order. Down the lane the baker\'s cart goes by, and the house lets out its breath.',
    'A thin cold drizzle, and the kind of sky that cannot make up its mind. Boots stand in a row by the door, each with a puddle of its own.',
  ],
  // by how the resident is (rules.js fetchMood): a line about them, to be filled with {Name} {Subj} {Poss}
  mood: {
    willing: ['{Name} is already up and has laid the table for everyone, and is pretending not to wait to be noticed.', '{Name} comes down humming and has put the porridge on before anyone asked.'],
    sullen: ['{Name} is at the table with {Poss} arms folded, and has an expression that could curdle milk.', '{Name} has not said a word since waking, and has said it quite loudly.'],
    cheeky: ['{Name} slides down the banister, lands badly, and acts as though that was the plan.', '{Name} is on the wrong side of the kitchen table, eating the thing that was meant for later.'],
    flustered: ['{Name} has put {Poss} boots on the wrong feet and only noticed on the stairs.', '{Name} is looking for something that {Subj} has been holding for some time.'],
    plain: ['{Name} comes in with the cold on {Poss} coat, and sits down to breakfast like anyone.', '{Name} is already at the window, watching the lane for no reason {Subj} could name.'],
  },
  own: {
    red: '{Name} came in from the garden with flowers in {Poss} hair and no recollection of what {Subj} went out to fetch.',
    goldilocks: '{Name} has tried three chairs at the breakfast table and has opinions on all of them.',
    rapunzel: '{Name} stood at the highest window for a while before coming down, and says it was only for the light.',
    jack: '{Name} has a new plan, which he is about to explain to anyone who will hold still.',
    hans: '{Name} has been sitting out in the cold since dawn, and does not understand why that is worrying.',
    snow: '{Name} has already agreed to three different things this morning, two of which cannot both be done.',
  },
  list: {
    easy: 'The list on the kitchen wall today is a gentle one: {things}.',
    hard: 'The list on the kitchen wall is not a gentle one today: {things}, and {hardest} is going to want someone steady.',
    plain: 'There is work on the list for everyone: {things}.',
  },
};
// One-line narration for results that have none of their own.
const RESULT_LINES = {
  reprieve: {
    stern: 'You take {Name} aside and say it plainly, without raising a hand. {Subj} listens to every word, and does not look away.',
    kind: 'You sit down with {Name} and ask, and then you listen. It takes a long time, and by the end of it something has eased.',
    reflection: 'You put pen and paper in front of {Name} and leave {Obj} to it. For a long while the only sound in the room is the scratching of the nib.',
  },
  aftercare: {
    corner: '{Name} stands facing the wall, hands behind {Poss} back, and for a few quiet minutes there is nothing to do but think.',
    lines: '{Name} is set to copy out a page, carefully, and does it. Slowly the hand steadies.',
    held: 'You stay with {Name} until it eases, and nobody says much, and nobody needs to.',
    warm: 'Afterward you say something kind, and mean it, and {Name} lets the words in.',
  },
};

// ── Changing the scene: what the interlude tells, in order (implement, position, clothes). {Name} {Subj} {Obj} {Poss} {Title} {Impl} ─
// Tone: gentle (for the willing and the flustered), firm, stern (for the cheeky and the sullen) — set by how they are (rules.js fetchMood).
const CHANGE = {
  helpUp: {
    calm: 'You take {Name}\'s hands and help {Obj} up from across your lap.',
    sore: 'You take {Name}\'s hands and help {Obj} up from your lap; {Subj} comes up slowly, rubbing the sting out with the heel of a hand.',
    spent: 'You take {Name}\'s arms and lift {Obj} gently up from your lap, and keep a hand on {Poss} elbow until {Subj} is steady.',
  },
  helpBack: 'You take {Name}\'s hand and help {Obj} back down across your knees, and settle {Poss} weight with a hand at the small of {Poss} back.',
  standOrder: { gentle: '"Up you get, {Name}, nice and slowly."', firm: '"Up. On your feet."', stern: '"Up, {Name}. On your feet. Now."' },
  stands: '{Name} gets up off your lap and straightens {Poss} clothes.',
  putDown: 'You set the {Impl} aside. Your hand will do.',
  selfFetch: 'You get up, go and fetch the {Impl} yourself, and say nothing about it.',
  selfBack: 'You come back with the {Impl}. {Name} has not moved.',
  backInPlace: '{Name} takes {Poss} place again.',
  position: {
    lap: { gentle: '"Come here, {Name}. Across my knee."', firm: '"Over my knee, {Name}."', stern: '"Over my knee. Don\'t make me say it twice."' },
    case: { gentle: '"Over to the table, {Name}, and lay your hands flat."', firm: '"The table. Bend over it, palms flat."', stern: '"To the table. Bend. Palms flat, and stay there."' },
    head: { gentle: '"Stand here in the middle of the room, {Name}, and put your hands on your head."', firm: '"Middle of the room. Hands on your head, fingers laced."', stern: '"Middle of the room. Hands on your head. And keep them there."' },
    chair: { gentle: '"Take hold of the seat of my chair, {Name}, and bend forward."', firm: '"Hold the seat of the chair. Bend."', stern: '"Hands on that chair, and bend. Do not let go."' },
    spread: { gentle: '"Feet apart a little, {Name}, and bend forward — hands on your thighs."', firm: '"Feet apart. Bend forward, hands on your thighs."', stern: '"Feet apart. Bend. Hands on your thighs, and hold it."' },
    hips: { gentle: '"Lie forward on the table, {Name}, and take hold of the edge."', firm: '"Chest down on the table. Hold the edge."', stern: '"Down on the table. Hold the edge, and do not let go."' },
  },
  obey: {
    willing: '"Yes, {Title}." {Name} goes at once.',
    sullen: '{Name} sets {Poss} jaw, and does it, with as little grace as can be managed.',
    cheeky: '"Bossy," {Name} mutters, but goes.',
    flustered: '{Name} nods too many times, fumbles, and hurries to obey.',
    plain: '{Name} nods and goes.',
  },
  take: {
    lap: '{Name} crosses to you and lets you draw {Obj} down across your lap.',
    case: '{Name} bends at the hips and lays {Poss} palms flat on the boards.',
    head: '{Name} stands in the middle of the room and laces {Poss} fingers on top of {Poss} head.',
    chair: '{Name} bends forward and takes hold of the seat of the chair.',
    spread: '{Name} widens {Poss} stance, bends forward, and settles {Poss} palms on {Poss} thighs.',
    hips: '{Name} lies forward across the table, chest on the boards, and curls {Poss} fingers over the far edge.',
  },
  clothes: {
    bottomsDown: 'You take hold of the waistband of {Poss} bottoms and draw them down to {Poss} knees.',
    bottomsUp: 'You draw {Poss} bottoms back up and settle the waistband.',
    briefsDown: 'You hook your thumbs in {Poss} briefs and draw them down after.',
    briefsUp: 'You draw {Poss} briefs back up into place.',
    react: {   // (one is picked, some of the time: see ui.js planChanges)
      willing: ['{Name} holds still for it and does not look round.', '{Name} steps out of the way without being asked, and keeps {Poss} eyes on the floor.', '"Thank you, {Title}," {Name} murmurs, quite steadily.', '{Name} lets out a long breath and stands as {Subj} should.'],
      sullen: ['{Name} stares straight ahead and says nothing at all.', '{Name} looks at the wall, jaw set, and lets it happen.', '{Name} makes a small, flat sound through {Poss} nose, and nothing more.', '{Name} shifts {Poss} weight once, hard, and then is still.'],
      cheeky: ['{Name} glances back over {Poss} shoulder, and receives a look that settles the matter.', '{Name} wiggles, once, as if testing the rules, and thinks better of a second try.', '"Draughty," {Name} observes, to the room in general.', '{Name} grins at the floor, until the grin runs out.'],
      flustered: ['{Name} goes pink to the ears and screws {Poss} eyes shut.', '{Name} covers {Poss} face with both hands for a moment, then lowers them again.', '{Name} breathes in sharply, and tries to think of something else.', '{Name} whispers a small, hurried apology to nobody in particular.'],
      plain: ['{Name} lets you.', '{Name} breathes out slowly and stays where {Subj} is.', '{Name} folds {Poss} hands and waits.', '{Name} takes it in silence.'],
    },

  },
};

// A line from the subject each time the scene reopens: by how they are (mood), and how composed (band of distress).
const REOPEN = {
  willing: {
    calm: ['"I\'m ready, {Title}."', '"Whenever you like, {Title}. I\'m all right."'],
    warm: ['"I\'m still here, {Title}. I\'m listening."', '"That did sting. But I understand why, {Title}."'],
    edge: ['"I\'m trying, {Title}. I\'m really trying to hold on."', '"Please — I\'ll be good, {Title}. I\'m close to the end of it."'],
    past: ['"I can\'t — {Title}, I\'ve nothing left to give."'],
  },
  sullen: {
    calm: ['"Go on, then. Get it over with."', '"I haven\'t said I\'m sorry. Just so we\'re clear."'],
    warm: ['"Don\'t think that\'s changed my mind."', '{Name} says nothing, but {Poss} breathing is not quite steady.'],
    edge: ['"Fine. FINE. I heard you."', '"That\'s — enough. That\'s enough, surely."'],
    past: ['"I\'m done. I\'m done, {Title}, I mean it."'],
  },
  cheeky: {
    calm: ['"Back already? I was just getting comfortable."', '"Go on, then, {Title}. I\'ve had worse."'],
    warm: ['"Hardly felt it." (The voice is a little too bright.)', '"All right, that one I felt. Don\'t let it go to your head."'],
    edge: ['"Okay — okay, point taken. Can we maybe not take it any further?"', '"I\'ll behave, I will. Mostly. Truly."'],
    past: ['"Not funny any more, {Title}. Not funny at all."'],
  },
  flustered: {
    calm: ['"Sorry — sorry, I\'m ready, I think. Am I ready?"', '"I\'m all right, {Title}. I\'m just — all right."'],
    warm: ['"Is that — am I doing it right, {Title}?"', '"It\'s a lot. It\'s a lot, but I\'m here."'],
    edge: ['"I can\'t think. I can\'t think at all, {Title}."', '"Please, {Title}, I\'ll do it properly, I promise, I will."'],
    past: ['"I\'m sorry, I\'m so sorry, I can\'t — "'],
  },
  plain: {
    calm: ['"All right, {Title}. Go on."', '"I\'m ready."'],
    warm: ['"I\'m sore, {Title}. But I\'m here."', '"I understand. Go on."'],
    edge: ['"I don\'t know how much more I can take, {Title}."', '"I\'m close, {Title}. Please."'],
    past: ['"No more, {Title}. Please. No more."'],
  },
};

// ── Afterwards: the scenes. By mood (rules.js fetchMood). `corner` and `lines` narrate how they are while it is done (the subject's bubble); `held` and `warm` are what the
// player says (calming words, kind words); `bed` is how they leave the room, as it is read on the interstitial. {Name} {Subj} {Obj} {Poss} {Title} ─
const AFTER_SCENES = {
  corner: {
    willing: ['{Name} stands very still with {Poss} fingers laced on top of {Poss} head, and does not fidget once. By the end {Subj} is breathing evenly.', '"I\'m thinking about it, {Title}. Properly." {Name} keeps {Poss} eyes on the join of the walls and means it.'],
    sullen: ['{Name} stares at the wall as though it owed {Obj} something. Somewhere around the third minute {Poss} shoulders come down a little.', '{Name} mutters something to the corner. It does not answer. After a while neither of them is angry.'],
    cheeky: ['{Name} counts the stones under {Poss} breath, loses count, and starts again. Once, quite quietly, {Subj} giggles at the wall.', '"Is this the good corner? It\'s a nice corner." {Name} falls silent, a minute later, with the air of someone who has run out of material.'],
    flustered: ['{Name} fidgets for the first minute, and then, slowly, stops. The tension runs out of {Poss} shoulders a little at a time.', '{Name} whispers an apology to the wall, twice, and then simply breathes.'],
    plain: ['{Name} waits in the corner with {Poss} hands on {Poss} head, and the room goes quiet round {Obj}.', '{Name} stands there, and thinks, and lets it settle.'],
  },
  lines: {
    willing: ['{Name} bends over the page, tongue between {Poss} teeth, and writes every line as neatly as the first.', '"Nearly done, {Title}." {Name} does not hurry, and the last line is as careful as the first.'],
    sullen: ['{Name} writes with the pen pressed down hard enough to dent the table. The lines come out straight, all the same.', '{Name} scowls at the paper, and writes, and by the fourth page the scowl has gone slack.'],
    cheeky: ['{Name} writes the first lines in an enormous flourish, then in a cramped hand, then in a very good copy of {Poss} own signature, and then settles down and does them properly.', '"Do they have to be joined up?" {Name} asks no one. They do. {Subj} joins them up.'],
    flustered: ['{Name} blots the first page and starts again, then again, and finally finds a rhythm and keeps it.', '{Name} writes, rubs a line out, and writes it again, and by the end {Poss} hand has stopped shaking.'],
    plain: ['{Name} writes steadily, and the only sound is the scratch of the pen.', '{Name} works down the page one line at a time, and does not look up until the last one.'],
  },
  held: {
    willing: ['"There. There now. You took it so well. It\'s over, and I\'m right here."', '"Breathe, {Name}. That\'s it. You\'ve done everything I asked, and I\'m proud of you."'],
    sullen: ['"You don\'t have to say anything. I\'ve got you. It\'s done, and nothing between us is changed."', '"Let it go, {Name}. You can be cross tomorrow. For now, just let me hold you."'],
    cheeky: ['"No jokes needed. It\'s over, and you were braver than you\'re letting on. Come here."', '"Shh. I know. I know. You\'re all right, you\'re all right."'],
    flustered: ['"Slowly. In — and out. There\'s nothing more to do. It\'s all done, and you\'re safe."', '"Hush, now. You\'re shaking. Let me hold you until it passes."'],
    plain: ['"It\'s done, {Name}. It\'s over. Breathe."', '"I\'ve got you. Take your time. There\'s no hurry at all."'],
  },
  warm: {
    willing: ['"You did well, {Name}. I want you to know that I see how hard you try, and it matters to me."', '"Thank you for taking it as you did. I think a great deal of you."'],
    sullen: ['"I know you don\'t agree with me. I only want you to know that this is not the end of how I think of you."', '"You may be angry; that\'s allowed. But you are not in trouble with me any more. We\'re square."'],
    cheeky: ['"You\'re a handful, {Name}, and I wouldn\'t have you any other way. That\'s over, and I\'m glad you\'re here."', '"Come on, then. Fair is fair: you took it, and now it\'s done, and I\'m fond of you."'],
    flustered: ['"You\'re doing better than you think, {Name}. Truly. Look at me — it\'s all right now."', '"It\'s over, and you did nothing wrong in how you bore it. I\'m not cross any more."'],
    plain: ['"That\'s done with, {Name}. I won\'t hold it against you, and I hope you won\'t hold it against me."', '"You did what was asked. Thank you. We start fresh now."'],
  },
  bed: {
    willing: ['{Name} nods, murmurs "Goodnight, {Title}," and goes up quietly, the stair creaking in the dark.', '"Thank you, {Title}." {Name} squeezes your hand, goes up to bed, and does not look back.'],
    sullen: ['{Name} goes up without a word, and closes the door of the room a little harder than needed. After a minute the house is quiet.', '{Name} gives you one long look, and then goes to bed. There is no sound from upstairs.'],
    cheeky: ['"Night, then." {Name} salutes from the stairs, and goes up, and only winces a little on the top step.', '{Name} makes a face at the stairs, and then makes a better one at you, and goes to bed.'],
    flustered: ['{Name} stammers goodnight, gets halfway to the door, comes back to say sorry once more, and then finally goes up to bed.', '{Name} hurries up the stairs, and for a moment on the landing you hear {Obj} let out a breath.'],
    plain: ['{Name} says goodnight and goes up to bed.', '{Name} gathers {Poss} things, nods to you, and goes quietly up the stairs.'],
  },
};

// The narration that goes with what the player says in Held After and Warm Words (the words themselves are AFTER_SCENES.held / .warm).
const AFTER_NARR = {
  held: ['You wrap your arms round {Name} and draw {Obj} in, and {Subj} folds against you as the shaking eases. You speak low, close to {Poss} ear.', 'You hold {Name} for a long while, one hand slowly stroking {Poss} back, until {Poss} breathing comes level. Then you say quietly:', 'You take {Name} in against you and stay there, saying nothing at first. When {Subj} has stopped trembling, you murmur:'],
  warm: ['You sit back in the chair and wait until {Name} lifts {Poss} eyes to yours. Then, gently:', 'You hold {Name}\'s gaze, and let a little of the sternness go out of your face. You say, kindly:', 'You look at {Name} for a moment, and your expression softens. You say:'],
};

// Narration for new arrivals: one, or several together.
const ARRIVAL_NARR = {
  one: ['There is a knock at the door of Birchwood House, hesitant, and then again, a little firmer. On the step stands someone with a bundle and a story, waiting to be let in.', 'A new face comes up the path as the light changes, stops at the gate, and straightens {their} shoulders before coming the rest of the way.', 'The kettle has barely boiled when the latch lifts. Someone new is standing in the doorway, holding a bag, looking at the room as if it might say no.'],
  many: ['The door opens more than once. By the time the kettle has boiled there are new people in the hall, bundles at their feet, looking round at the house and at each other.', 'They come up the path together or one by one, and gather in the hall of Birchwood House with their bags, a little unsure who is meant to speak first.', 'A knock, and then another, and a third. The hall fills with new arrivals, each with a story that ended somewhere short.'],
};

// The last page of a game. `grown`: who a resident is when they move on, from what the house taught them. `lost`: why a bridge was broken, and what that may mean out in the world.
const EPILOGUE = {
  red: {
    grown: 'Red still takes the path, but now she knows why it is there. She has learned to stay with a task past the first flower, and to say what she is thinking before it turns into trouble. Out in the world she will be the one who is still on the road when others have wandered off, and she will not be frightened of the wolf, only careful.',
    lost: 'Red was never made to see why the rules mattered, and she took the hand that came instead of the reason as a verdict on her. She left having learned only that the path is guarded by people who do not explain. Out in the world she may keep meeting that guard, and keep leaving the road to spite it.',
  },
  goldilocks: {
    grown: 'Goldilocks has learned that a house is not a menu. She finishes what she starts, leaves the small chair whole, and can hear "no" without needing it to be negotiable. Out in the world she will be a guest people are glad to see come back.',
    lost: 'Goldilocks tested every limit until she found one that held, and then found that she could not forgive it for holding. She left certain that no house would ever be just right. Out in the world she may go on trying other people\'s chairs, and finding fault with each, until one of them is hers.',
  },
  rapunzel: {
    grown: 'Rapunzel has stopped waiting at the window. She says what she wants aloud, and has found that she can be wanted by the house without having to be rescued from it. Out in the world she will climb down on her own, and mean it.',
    lost: 'Rapunzel kept her wishes to herself so long that the house never learned them, and it answered the quiet girl, not the one inside. She left unseen, again. Out in the world she may go back to a tower of her own making, and keep letting down her hair for whoever happens to pass.',
  },
  jack: {
    grown: 'Jack has learned that the luck was never the whole of it. He plants what he trades for, counts what he is given, and has found out how little he needs to climb. Out in the world he will be careful of beanstalks, and kind to the people at the bottom of them.',
    lost: 'Jack read every consequence as a trick, and every kindness as a trade he had not agreed to. He left sure that nothing is given freely. Out in the world he may keep gambling on beans, and keep being surprised when the giant is at home.',
  },
  hans: {
    grown: 'Hans has learned to shiver, and to be glad of it. He feels the cold, and the warmth, and the difference, and he can say so. Out in the world he will not be fearless any more, which is a better thing to be than he knew.',
    lost: 'Hans found that nothing the house did reached him, and so, in the end, nothing it said did either. He left unchanged, and not unhurt. Out in the world he may keep walking into the haunted castle, waiting for the thing that will finally make him feel it.',
  },
  snow: {
    grown: 'Snow White has found out that she can open her own door, and that most apples are only fruit. She names what she wants, takes help when it is offered and not only when it is forced on her, and no longer waits to be woken. Out in the world she will be the one holding the knife, and the bread.',
    lost: 'Snow White had been rescued so often that being held to account felt like one more thing done to her, and she would not be rescued from it. She left the way she had always left: quietly, trusting no one. Out in the world she may keep sleeping through the days that matter, and distrusting everyone who wakes her.',
  },
};

root.FairyShoeContent = { MORNING, RESULT_LINES, SCENES, MOVES, STATS, STAT_NAMES, STAT_HINTS, CHARACTERS, ORDER, CHORES, CHORE_LINES, PAIR_LINES, EVENTS, CATEGORIES, REPRIEVES, AFTERCARE, SAYINGS, CHANGE, REOPEN, AFTER_SCENES, AFTER_NARR, ALONE_LINES, ARRIVAL_NARR, EPILOGUE };
if (typeof module !== 'undefined' && module.exports) module.exports = root.FairyShoeContent;
})(typeof window !== 'undefined' ? window : globalThis);
