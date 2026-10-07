// ΩΤΚ Companion — content: the cast, the duties, the event templates and the lines people say.
// Pure data, no DOM and no three.js, so the rules (and their tests) can run in Node.
//
// Everyone in the house is an adult (19+) who is on Probation inside a chapter they chose to join, and who understands what
// Probation is and what happens at the end of a night on the list. `{Title}` is whatever the player is called (Avery, unless
// renamed); the player is otherwise only ever "you". The player is the Big, and she is Avery: there is no other choice to make.
(function (root) {
'use strict';

const STATS = ['wil', 'att', 'res', 'sat', 'val', 'com'];
const STAT_NAMES = { wil: 'Wilfulness', att: 'Attention', res: 'Resentment', sat: 'Satisfaction', val: 'Valued', com: 'Composure' };
const STAT_HINTS = {
  wil: 'defiance; the higher it is, the firmer a hand it takes',
  att: 'how well the work gets done',
  res: 'grievance; escalation risk',
  sat: 'day-to-day contentment, and how secure she feels',
  val: 'trust that a correction comes from care',
  com: 'whether a lesson lands and lasts',
};

// ── The cast ────────────────────────────────────────────────────
// file: the official write-up on the Standards Committee's record (all the player is shown at first).
// story: what is actually going on (shown once she has been Cleared, never before).
// base: starting spread. grad: what must hold, all at once, for her to be Cleared (never shown). gradeOk: she must not be Failing on Grades.
// pain: how she takes correction (the engine's tolerance / resilience, 0–1). traits: how the rules bend for her (rules.js changeStat).
// bias: multipliers on the event categories she drifts toward. startGrades: where she begins on Grades.
const SHE = ['she', 'her', 'her', 'herself'];
const CHARACTERS = {
  lila: {
    id: 'lila', handle: '@lila', name: 'Lila', age: 21, pronouns: SHE,
    tagline: 'Stopped showing up rather than ask.',
    file: 'Repeated absence from mandatory chapter events; unresponsive to Big check-ins.',
    story: 'Lila does not trust that reaching out will be met with care instead of obligation, so she quietly stopped showing up rather than risk asking for space and being told no. She performs ease so well that nobody has asked what it costs, and the moment anyone looks at her sincerely she reaches for irony. She never struggled to comply. She struggled to believe a correction could come from care.',
    base: { wil: 3, att: 4, res: 2, sat: 3, val: 2, com: 3 },
    grad: [['val', '>=', 5], ['wil', '<=', 2]],
    pain: { tolerance: 0.5, resilience: 0.45 },
    traits: [], distrustsOvershoot: true,
    note: 'Needs trust before behaviour follows. She does not struggle to comply; she struggles to believe it comes from care. Over-correction reads as proof she was right not to trust it.',
    bias: { dishonest: 1.2 },
    lines: {
      open: ['"That sounds like a line, {Title}. Go on."', '"I’m fine. I’ll tell you if I’m not. I will."'],
      leave: '"I asked for something today, {Title}. Out loud. It went fine."',
    },
  },
  taylor: {
    id: 'taylor', handle: '@taylor', name: 'Taylor', age: 20, pronouns: SHE,
    tagline: 'Loud-laughed, and waiting to be noticed.',
    file: 'GPA below chapter minimum; unresolved property incident (a missing house item, since recovered).',
    story: 'Taylor is burying real academic stress and shame under a bright front. "Fine, I’m fine" is load-bearing. She has come to believe she has to wait until it is bad enough that someone steps in, so she is funny at exactly the moments it costs her, and goes quiet in the ones that matter. Nothing she did was rebellion. She just has not learned that asking counts.',
    base: { wil: 2, att: 3, res: 4, sat: 3, val: 3, com: 2 },
    grad: [['val', '>=', 5]], gradeOk: true, startGrades: 'At Risk',
    pain: { tolerance: 0.4, resilience: 0.4 },
    traits: [],
    note: 'A trap: low Wilfulness hides real Resentment. Visible-defiance correction misses the problem; she conceals instead of defying, and needs to be noticed before it gets bad.',
    bias: { dishonest: 2.2, neglect: 2.2 },
    lines: {
      open: ['"Okay! Ha. Love that for me. Where do you want me?"', '"I’m fine. Honestly. Yeah. Go ahead."'],
      leave: '"I asked for help before it got bad, {Title}. First time. Put it on my permanent record."',
    },
  },
  hannah: {
    id: 'hannah', handle: '@hannah', name: 'Hannah', age: 19, pronouns: SHE,
    tagline: 'Said yes because she wanted to be liked.',
    file: 'New-member conduct violation: out past pledge curfew, unauthorized off-campus visit during New Member period.',
    story: 'Hannah said yes to something she knew she should not, because she wanted to be liked and had no way yet of telling an older sister no. It was eagerness, not defiance. She is quiet and quietly competent, and she moves in any direction too easily; that ease gets mistaken for security. She withdraws when she cannot find her place, and waits to see whether anyone notices.',
    base: { wil: 2, att: 3, res: 1, sat: 4, val: 4, com: 2 },
    grad: [['com', '>=', 5], ['sat', '>=', 5]],
    pain: { tolerance: 0.35, resilience: 0.4 },
    traits: [{ stat: 'val', factor: 2 }, { stat: 'sat', factor: 0.5 }],
    note: 'The mirror of Taylor: too easy to move, in any direction, and the ease gets mistaken for security. Satisfaction moves slowly even when she looks valued. Needs consistency of source, not just warmth.',
    bias: { neglect: 1.4 },
    lines: {
      open: ['"Yes, {Title}. Whatever you think. Am I — is this right?"', '"I don’t mind. I just — can I ask something after?"'],
      leave: '"I said no to someone, {Title}, and I wasn’t in the way. I wanted you to know."',
    },
  },
  jess: {
    id: 'jess', handle: '@jess', name: 'Jess', age: 21, pronouns: SHE,
    tagline: 'Appetite, not grievance.',
    file: 'Pattern of minor conduct violations (noise complaints, unauthorized guests) accumulated into a formal file.',
    story: 'Jess is genuinely testing what she can get away with. It is appetite, not grievance, and nothing has really landed on her yet, which is half of why she keeps pushing. She is cheerful and notices more than she lets on, offering it lightly, and she makes herself very easy to overlook.',
    base: { wil: 5, att: 3, res: 1, sat: 5, val: 4, com: 3 },
    grad: [['wil', '<=', 3]],
    pain: { tolerance: 0.65, resilience: 0.6 },
    traits: [{ stat: 'res', factor: 0, sources: ['overshoot1'], when: { val: ['>=', 4] } }],
    note: 'High Wilfulness, low Resentment: defiance is appetite. Takes a firm hand well so long as she still feels valued. Played too soft, it reads as nothing happened.',
    bias: { petty: 1.3, boundary: 1.2 },
    lines: {
      open: ['"Go on, {Title}. I’ve had worse. Probably."', '"Okay, but for the record, it was a very reasonable amount of noise."'],
      leave: '"First time anything’s stuck, {Title}. Turns out I don’t hate it."',
    },
  },
  marcy: {
    id: 'marcy', handle: '@marcy', name: 'Marcy', age: 21, pronouns: SHE,
    tagline: 'Quietly numb; needs to be noticed.',
    file: 'Failure to complete assigned committee responsibilities, two terms running.',
    story: 'Marcy is not lazy. She has gone quietly numb, to the point where a missed deadline does not register as a real consequence. She is dry and composed from the outside and takes up very little room. She needs to be noticed, not assigned more.',
    base: { wil: 2, att: 4, res: 1, sat: 4, val: 3, com: 1 },
    grad: [['com', '>=', 6]],
    pain: { tolerance: 0.88, resilience: 0.8 },
    traits: [{ stat: 'wil', factor: 0.5, sources: ['correction'] }],
    note: 'Composed from the outside: severity barely registers, and escalating on her is the wrong move. She moves on aftercare and attention.',
    bias: { neglect: 1.4 },
    lines: {
      open: ['"Behave," {Subj} tells herself, drily. "Okay. Go ahead, {Title}."', '"I’m ready. Whatever you think is needed."'],
      leave: '"Night, {Title}. I felt that. All of it. It was weird. Good weird."',
    },
  },
  sloane: {
    id: 'sloane', handle: '@sloane', name: 'Sloane', age: 22, pronouns: SHE,
    tagline: 'Never told no, and had it stick.',
    file: 'Repeated disregard for officer authority; unauthorized personal use of chapter resources (event budget, house car).',
    story: 'Legacy status taught Sloane that rules are more like suggestions where she is concerned. It is entitlement, not malice: she has never actually been told no and had it stick. A kind word early reads to her as no consequence at all.',
    base: { wil: 4, att: 3, res: 2, sat: 4, val: 2, com: 1 },
    grad: [['wil', '<=', 3], ['att', '>=', 4], ['val', '>=', 4]],
    pain: { tolerance: 0.55, resilience: 0.5 },
    traits: [], reprieveBacklash: true,
    note: 'Entitled rather than malicious. Needs consistency, not softness; a reprieve early on reads as no consequence at all.',
    bias: { boundary: 1.3, petty: 1.1 },
    lines: {
      open: ['"Do we have to do this in here? Fine. I’ll say now that it’s excessive."', '"Go on, then, {Title}. Let’s see if this one sticks."'],
      leave: '"You told me no, {Title}, and it held. I don’t think I knew that could happen."',
    },
  },
};
const ORDER = ['lila', 'taylor', 'hannah', 'jess', 'marcy', 'sloane'];
const FIRST_THREE = ['lila', 'taylor', 'jess'];   // the three named on the opening memo

// ── Duties ──────────────────────────────────────────────────────
// diff 1–3. `sec`: a secondary stat that bears on it. Paired duties take two sisters (and how well they get on). Phrase fills {Duty}.
const CHORES = [
  { id: 'dish', name: 'Dish Duty', phrase: 'the dishes', diff: 1 },
  { id: 'common', name: 'Common Room Tidy', phrase: 'the common room', diff: 1 },
  { id: 'trash', name: 'Trash & Recycling Run', phrase: 'the trash run', diff: 1 },
  { id: 'bath', name: 'Restocking the Hall Bathroom', phrase: 'the bathroom restock', diff: 1 },
  { id: 'grocery', name: 'Grocery Run', phrase: 'the grocery run', diff: 2 },
  { id: 'cook', name: 'Cooking for the House', phrase: 'dinner', diff: 2 },
  { id: 'laundry', name: 'Laundry (own hall)', phrase: 'the laundry', diff: 2 },
  { id: 'study', name: 'Study Hours Log-In', phrase: 'study hours', diff: 2, sec: 'sat' },
  { id: 'dues', name: 'Dues Reconciliation', phrase: 'the dues', diff: 3 },
  { id: 'ritual', name: 'Ritual Room Prep', phrase: 'the ritual room', diff: 3 },
  { id: 'decorating', name: 'Formal Decorating', phrase: 'the formal decorating', diff: 2, paired: true },
  { id: 'folders', name: 'Rush Folder Prep', phrase: 'the rush folders', diff: 2, paired: true },
  { id: 'furniture', name: 'Moving Furniture (chapter meeting setup)', phrase: 'the furniture', diff: 2, paired: true },
];
// What each duty is leaning on, as the duty card says it (Attention plus whatever else bears on it).
const CHORE_STAT_NOTE = { study: 'Attention + Satisfaction', decorating: 'Attention + how well they get on', folders: 'Attention + how well they get on', furniture: 'Attention (how well they get on, a little)' };

// What she says about her duty in her own post, by outcome. {Partner} on paired ones.
const DUTY_LINES = {
  dish: {
    well: 'dishes done and the sink is EMPTY. i’d like that noted somewhere permanent.',
    completed: 'dishes are done.',
    partial: 'got through most of the dishes. the pans are soaking. that counts as in progress',
    failed: 'dishes didn’t happen. i’ll get them tomorrow probably' },
  common: {
    well: 'common room is immaculate. i moved the cushions and everything.',
    completed: 'common room’s tidied.',
    partial: 'common room’s about half done. the good half.',
    failed: 'did not get to the common room. it’s honestly not worse than it was' },
  trash: {
    well: 'trash out, recycling sorted, bins back in. a clean sweep.',
    completed: 'trash and recycling are out.',
    partial: 'took the trash out. recycling’s still sitting by the door.',
    failed: 'trash is still in the kitchen. i know. i KNOW.' },
  bath: {
    well: 'hall bathroom is fully stocked. there is so much toilet paper. you’re all welcome.',
    completed: 'hall bathroom’s restocked.',
    partial: 'restocked the bathroom except we’re out of half of it so. partial credit',
    failed: 'never made it to the bathroom supplies. someone else is gonna have to' },
  grocery: {
    well: 'grocery run done, everything on the list, plus i got the good bread.',
    completed: 'groceries are in the kitchen.',
    partial: 'got most of the list. they were out of like four things allegedly',
    failed: 'did not make it to the store. time got away from me' },
  cook: {
    well: 'dinner was GOOD tonight. people had seconds. i’m choosing to feel great about that.',
    completed: 'cooked dinner. everyone ate.',
    partial: 'dinner was edible. that’s the review i’m going with.',
    failed: 'dinner did not happen. there’s cereal.' },
  laundry: {
    well: 'hall laundry done, folded, back where it belongs. i’m a machine.',
    completed: 'hall laundry’s done.',
    partial: 'laundry’s washed. not folded. one thing at a time',
    failed: 'laundry’s still sitting in the machine. it’s fine. it’s probably fine.' },
  study: {
    well: 'study hours logged, all of them, actually sat there the whole time.',
    completed: 'study hours are logged.',
    partial: 'logged study hours. some of them. i was THERE for some of them',
    failed: 'didn’t log study hours. i’ll double up tomorrow' },
  dues: {
    well: 'dues are reconciled to the cent. don’t ask me how long it took.',
    completed: 'dues are reconciled.',
    partial: 'dues are mostly reconciled. there’s a discrepancy i’m choosing to sleep on',
    failed: 'the dues spreadsheet defeated me tonight. we’ll go again tomorrow' },
  ritual: {
    well: 'ritual room is set. candles, chairs, everything squared. it looks right.',
    completed: 'ritual room’s prepped.',
    partial: 'ritual room’s mostly set. the candles are wrong and i know it',
    failed: 'ritual room isn’t ready. i ran out of time and that’s the truth of it' },
  decorating: {
    well: 'formal decorating is DONE. {Partner} and i basically read each other’s minds. the centerpieces are perfect.',
    completed: 'formal decorations are up. me and {Partner} got it done.',
    partial: 'formal decorating is… mostly up. {Partner} and i had creative differences about the streamers',
    failed: 'formal decorating did not happen. {Partner} and i could not agree on a colour scheme, so there is no colour scheme' },
  folders: {
    well: 'rush folders are stuffed, labelled and alphabetised. {Partner} and i found a rhythm and just. kept it.',
    completed: 'rush folders are done. me and {Partner}.',
    partial: 'rush folders are about two thirds done. {Partner} thinks i did the other third. i think {Partner} did.',
    failed: 'rush folders: a tangle. {Partner} and i each did half of the same half.' },
  furniture: {
    well: 'chapter chairs are set, perfectly. {Partner} and i moved that whole room like it was nothing.',
    completed: 'chairs are set up for chapter. {Partner} and i did it.',
    partial: 'chairs are mostly where they go. {Partner} says the couch was my side. it was not my side',
    failed: 'the chapter room is still a mess. {Partner} and i could not agree where anything goes, so nothing went anywhere.' },
};
// A shared duty with nobody to share it: it cannot be done.
const ALONE_LINES = [
  'went to do {Duty} and it turns out it’s a two-person job. i stood there with it for a while.',
  'went to do {Duty}, looked around for someone to help, and found nobody. so. left it as it was',
  '{Duty} is no use to one pair of hands. i tried it anyway. there is very little to show for it',
];

// ── Events ──────────────────────────────────────────────────────
// Each is her own timeline post (`post`, in her voice) and the president’s private note on what actually happened (`truth`). {Name} {Subj} {Poss}
// {Obj} {Refl} {Second} {Title}; a pronoun that starts a sentence capitalises itself.
//   trap: the gentle answer is the right one (her post is misleadingly upbeat); `cw` a content flag she puts on it; `night`: an event that settles what
//   time she was up ('early' / 'late'); `only`: hers alone; `fx`: [stat, change] pairs for a setback.
const EVENTS = {
  setback: [
    { post: 'bad night. bad morning after it. nothing to add', truth: '{Name} had a bad night, and a bad morning after it. Whatever was getting steadier has gone loose again, and {Subj} won’t say why.', fx: [['com', -1], ['att', -1]] },
    { post: 'got a text from home. read it a lot of times. anyway what are we having for dinner', truth: 'A message came for {Name} from home that {Subj} read three times, and {Subj} has been somewhere else all day.', fx: [['att', -1], ['val', -1]] },
    { post: 'someone said i was doing really well today. rude honestly', truth: '{Name} was doing so well that someone said so, and {Subj} promptly did the opposite, as if checking it was still allowed.', fx: [['wil', 1], ['att', -1]] },
    { post: 'heard what this whole probation thing is "really" about. fascinating', truth: 'Someone told {Name} what Probation is "really" for, and {Subj} has been quietly doubting it ever since.', fx: [['val', -1], ['wil', 1]] },
    { post: 'old habits are a lot. no further comment', truth: 'The old habits came back all at once this afternoon, the way they do. {Name} caught them too late.', fx: [['com', -1], ['wil', 1]] },
    { post: 'woke up at 4 and never really stopped', truth: '{Name} woke at the hour {Subj} used to wake back before, and spent the whole day in that mood.', fx: [['sat', -1], ['com', -1]] },
    { post: 'the wifi died and so did my will to do anything else', truth: 'The wifi dropped, the printer jammed, and {Name} took all of it personally. Two weeks of good work went out with it.', fx: [['att', -1], ['sat', -1]] },
    { post: 'found my old pledge folder in a drawer. just sat there with it for a while', truth: '{Name} found something of {Poss} own from before in a drawer and could not put it down. Nothing else got done.', fx: [['att', -1], ['com', -1]] },
  ],
  petty: [
    { post: 'whoever made the name tags did a great job. very legible. anyway chapter meeting was WILD tonight', truth: '{Name} swapped {Poss} name tag with a pledge’s at chapter meeting, just to watch the confusion. {Subj} thought it was hilarious.' },
    { post: 'common room’s gonna have to stay like that, the vacuum has vanished. i looked everywhere. tragic.', truth: '{Name} was down for the common room and never touched it. The vacuum was in {Poss} own closet the whole time.' },
    { post: 'ok whoever keeps buying oat milk and then getting weird about it. it’s MILK. it’s for DRINKING.', truth: '{Name} finished someone else’s carton and put the empty back in the fridge, upright, like that settled it.' },
    { post: 'no idea who changed the group chat name. no idea at all. seems like a mystery for the ages', truth: '{Name} changed the house group chat name {Refl}, and is enjoying the speculation far too much to own up to it.' },
    { post: 'SO close to doing the dishes tonight and then something came up. twice. what are the odds', truth: '{Name} was asked to do the dishes twice. Both times {Subj} came back with a very good reason why {Subj} hadn’t.' },
    { post: 'missed duty assignment somehow?? nobody told me where it was. wild.', truth: '{Name} was in the laundry room the whole time, waiting for it to be over.' },
    { post: 'the chore chart has been defaced and honestly the artist has range', truth: '{Name} drew on the whiteboard chore chart and signed it with someone else’s initials.' },
    { post: 'apparently "why do you ask" is not a real answer. eight times in a row. who knew', truth: '{Name} deflected every question at dinner instead of answering one, and thought it was very funny.' },
    { post: 'there is a freshman crying in the senior lot and it’s not my fault, i simply lent out a key', truth: '{Name} handed a pledge {Poss} key to the reserved spot on purpose, to see what would happen.' },
    { post: 'everyone’s shoes are by the door smallest to largest now. you’re welcome. it’s called order', truth: '{Name} rearranged everyone’s shoes by the door, purely to watch the confusion in the morning.' },
    { only: 'lila', post: 'common room photo for the house account is UP. you’re welcome. the lighting took two hours', truth: '{Name} spent two hours staging the common room for a photograph, and left the duty {Subj} was actually meant to be doing exactly where it was.' },
    { only: 'taylor', post: 'if anyone finds the house mantel decoration, i have never seen it and also it’s not under my bed', truth: '{Name} took the house paddle down off the mantel "just to look at it", and has put it somewhere it will take a while to remember.' },
    { only: 'jess', post: 'a cereal box has been moved to the top shelf and i would like it known that i was not involved', truth: '{Name} ate a pledge’s entire labelled shelf of leftovers and left a smiley face in its place.' },
    { only: 'marcy', post: 'committee notes: attended. in spirit. in full', truth: '{Name} sat through the whole committee meeting without writing a thing down, for the second term running.' },
    { only: 'sloane', post: 'budget "reallocated". you’re welcome. the room looks AMAZING', truth: '{Name} moved chapter event money to a nicer venue deposit without telling anyone, and is rather pleased with the result.' },
  ],
  boundary: [
    { post: 'ok i tried on the formal dress. for a SECOND. it looked incredible. no notes', truth: '{Name} was told not to touch the formal dress before the fitting. {Subj} wore it anyway: "a second" was most of the afternoon.' },
    { post: 'back at a perfectly reasonable hour. define reasonable. i’m defining it generously', night: 'late', truth: '{Name} was asked to be in before curfew during rush week. {Subj} came in well after, unbothered.' },
    { post: 'had exactly one glass of something nice tonight. the bottle is basically untouched. basically.', truth: '{Name} was told that wine wasn’t for the house. The bottle sits exactly one inch lower, as if that wouldn’t be noticed.' },
    { post: 'i think knocking is kind of a formality between sisters honestly', truth: '{Name} was asked to knock before entering the Big’s room. {Subj} didn’t. Twice.' },
    { post: 'the top shelf of the pantry is a DEATH TRAP and i have the bruise to prove it', truth: '{Name} was told the top shelf of the pantry was officers only. {Subj} climbed for it anyway and knocked half of it down.' },
    { post: 'left chapter early. i had things to do and the things were not going to do themselves', truth: '{Name} was asked to wait to be excused from chapter meeting. {Subj} got up halfway through and simply left.' },
    { post: 'ate first, logged hours after. this is called optimizing', truth: '{Name} took a second serving at dinner before {Poss} duties were logged, and the hours went in late, half-filled, if at all.' },
    { post: 'back!! safe!! and in possession of a truly excellent hoodie that is not mine', truth: '{Name} was asked not to go to the fraternity house alone during a lockdown. {Subj} went anyway, with no apology in mind.' },
    { only: 'lila', post: 'not skipping anything. just working somewhere extremely quiet. very productive. nobody has to check', truth: '{Name} skipped mandatory chapter and spent the evening in a library carrel where nobody would think to look.' },
    { only: 'taylor', post: 'rush event was fun!!! i was there for ALL of it. the part i was there for', truth: '{Name} left the rush event after twenty minutes and sat in a stairwell until it was over, then came home as if nothing had happened.' },
    { only: 'hannah', post: 'sorry!! i said yes to something and now i have to be somewhere. long story. sorry', truth: '{Name} said yes to an older sister’s invitation to something {Subj} knew {Subj} shouldn’t, again, because saying no felt worse.' },
    { only: 'jess', post: 'noise complaint?? what noise. i was in a very small and very quiet meeting. with eleven people', truth: '{Name} threw a "very quiet" gathering that was not quiet, with guests who were not signed in.' },
    { only: 'sloane', post: 'house car is back. it was always going to be back. it’s the house’s car and i’m of the house', truth: '{Name} borrowed the house car without signing it out, again, and has never once been told no about it.' },
  ],
  friction: [
    { post: 'borrowed a straightener and it’s being dramatic now. not necessarily related. not necessarily mine to fix', truth: '{Name} took {Second}’s straightener without asking and broke it, and hasn’t said a word about it since.' },
    { post: 'long day. said something at dinner i’m not going to elaborate on. moving on', truth: '{Name} snapped at {Second} over nothing, and later wouldn’t say why.' },
    { post: 'not talking about the group chat thing. it’s fine. everything’s fine.', truth: '{Name} and {Second} haven’t spoken since yesterday. Neither will explain what happened.' },
    { post: 'got the good bathroom!! sometimes the universe simply provides', truth: '{Name} took the last spot in the good bathroom while {Second} was waiting on it, and didn’t seem to notice or care.' },
    { post: 'said the quiet part loud in the common room. the room got quiet too. anyway', truth: '{Name} said something sharp to {Second} in front of everyone. {Second} went quiet for the rest of the evening.' },
    { post: 'duty didn’t get done and honestly there were two of us on it so', truth: '{Name} blamed {Second} for a duty {Subj} hadn’t finished {Refl}. {Second} didn’t argue, but didn’t forget it either.' },
    { post: 'moved seats at dinner. the chair was loud. that’s on the chair', truth: '{Name} moved rather than sit near {Second}, and made sure the whole table noticed.' },
    { post: 'saw something i wasn’t supposed to see and now i have to live with that. no further comment', truth: '{Name} read something on {Second}’s laptop that wasn’t meant to be read. {Subj} won’t say what it was, and {Second} doesn’t know {Subj} saw it.' },
    { only: 'sloane', post: 'some people need to be told who the social chair is. i’ve told them. warmly', truth: '{Name} told {Second}, in front of the whole room, that anything {Second} wanted to ask an officer should "go through" {Obj} first.' },
  ],
  dishonest: [
    { post: 'the dues thing is handled. mostly. i’ve explained it twice already so', truth: '{Name} has told two different stories about where the missing dues money went, and neither one quite matched.' },
    { post: 'fine!! everything’s fine. long week. going to bed', cw: 'cw: fine, i’m fine', trap: true, truth: '{Name} is not fine. {Subj}’d been crying in the stairwell for the better part of an hour.' },
    { post: 'genuinely never saw the chapter meeting reminder. genuinely.', truth: '{Name} claims {Subj} never saw the chapter meeting reminder. {Subj} reacted to it in the group chat two hours earlier.' },
    { post: 'big dinner tonight!! so full. couldn’t eat another thing', trap: true, truth: '{Name} has been pushing food around {Poss} plate for a while now, and won’t say why, or how long it’s been going on.' },
    { post: 'the dress was ALREADY like that. i want that on the record.', truth: '{Name} says the broken formal dress wasn’t {Poss} doing. The evidence rather strongly suggests otherwise.' },
    { post: 'totally on top of classes!! don’t know what everyone’s worried about lol', cw: 'cw: fine, i’m fine', trap: true, night: 'late', truth: '{Name} is not keeping up fine. The light under {Poss} door burns very late.' },
    { only: 'lila', post: 'honestly so grateful for this week!! everything is great and i’m so happy', cw: 'cw: fine, i’m fine', trap: true, truth: '{Name} has been performing "fine" for so long it has stopped sounding like a performance, even to {Obj}. {Subj} is not fine.' },
    { only: 'lila', post: 'sorry, phone was dead. completely dead. it’s a very old phone', truth: '{Name}’s phone was not dead. {Subj} read your check-in, and left it where it was.' },
    { only: 'taylor', post: 'midterm went fine!! probably. i think it went fine', trap: true, truth: '{Name} didn’t sit the midterm. {Subj} sat in the stairwell until it was over, and told everyone it went fine.' },
    { only: 'hannah', post: 'everything’s great here!! i’m just in the library. at a table. by myself. it’s great', trap: true, truth: '{Name} has been alone in the library all evening, waiting for anyone to notice {Subj} wasn’t at the house table.' },
    { only: 'jess', post: 'i was in all night. i have a completely reliable witness', truth: '{Name} says {Subj} was in all night. {Poss} witness is a bag of baby carrots.' },
    { only: 'marcy', post: 'committee stuff? basically all caught up. basically', trap: true, truth: '{Name} hasn’t opened the committee folder in weeks, and doesn’t seem to feel anything about it. It isn’t laziness.' },
    { only: 'sloane', post: 'budget’s fine!! nothing to report. numbers are numbers', truth: '{Name}’s event budget does not add up, and {Subj} has been moving the numbers around since Tuesday.' },
  ],
  neglect: [
    { post: 'not hungry. again. it’s fine.', truth: '{Name} hasn’t touched {Poss} dinner in two days. When asked, {Subj} just shrugged.' },
    { post: 'up early. out before anyone.', truth: '{Name} used to be the loudest one in that kitchen. {Subj} hasn’t been in it all week.' },
    { post: 'in my room. don’t need anything.', truth: '{Name} has kept {Poss} door shut since morning, in full daylight.' },
    { post: 'breakfast. then class. that’s the whole update', truth: '{Name} sat apart from everyone again, and left before anyone could ask why.' },
    { post: 'everything’s the same as yesterday. that’s not a complaint', truth: '{Name} hasn’t laughed in days, not even at things that would usually get one out of {Obj}.' },
    { post: 'asleep by nine. up at noon. thriving', night: 'early', truth: '{Name}’s going to bed before anyone else in the house and rising after everyone’s left for class.' },
    { post: 'jumpy today. too much coffee probably', truth: '{Name} flinched over something entirely ordinary when {Subj} thought no one was looking. It isn’t the coffee.' },
    { post: 'no thoughts. nothing to add.', truth: '{Name} used to have an opinion about everything. {Subj} hasn’t offered one in a week.' },
    { only: 'lila', post: 'long day. i’ll text back. i will', truth: '{Name} has left your last three check-ins on read, and is not sure how to start the reply.' },
    { only: 'taylor', post: 'i ate. definitely. at some point', truth: '{Name} has skipped lunch and dinner and doesn’t seem to have noticed that {Subj} did.' },
    { only: 'hannah', post: 'there was a movie night? no it’s fine. i had stuff to do', truth: '{Name} stayed in {Poss} room through movie night rather than ask whether {Subj} was allowed to come down.' },
    { only: 'hannah', post: 'no idea where everyone went. i’m sure it’s fine', truth: '{Name} pulled a loose thread on {Poss} sleeve all through chapter, until half the cuff was gone, so as not to say what {Subj} was thinking.' },
    { only: 'marcy', post: 'fine. heating’s bad tho', truth: '{Name} has missed three meals and two meetings and said nothing. The only thing {Subj} mentioned was the heating.' },
  ],
  cruelty: [
    { post: 'said something tonight i probably shouldn’t have. she’ll get over it', truth: '{Name} told {Second} that nobody would notice if {Second} dropped out of the house. {Name} said it to be cruel, and knew it.' },
    { post: 'some people take rituals VERY seriously and i think that’s beautiful for them', truth: '{Name} mocked {Second} for still being nervous before rituals. {Second} didn’t answer, and went quiet for the rest of the evening.' },
    { post: 'things break. it happens. it happened right in front of her actually', truth: '{Name} took something small of {Second}’s and broke it on purpose, to see {Second}’s face fall.' },
    { post: 'told the common room something genuinely hilarious tonight. everyone agreed.', truth: '{Name} repeated something {Second} had told {Obj} in confidence, loudly, in front of the whole common room.' },
    { post: 'watched someone absolutely butcher a duty tonight and i said nothing. out loud.', truth: '{Name} laughed at {Second} for messing up a duty, and made sure {Second} knew {Subj}’d seen it.' },
  ],
};
// Base share, situational modifier on the correction, and the on-reveal stat effects (see rules.js).
const CATEGORIES = {
  petty:     { label: 'Petty Defiance / Mischief',  share: 30, mod: 0 },
  boundary:  { label: 'Boundary-Testing',           share: 20, mod: 1 },
  friction:  { label: 'Interpersonal Friction',     share: 20, mod: 1, needsSecond: true },
  dishonest: { label: 'Dishonesty / Concealment',   share: 15, mod: 1 },
  neglect:   { label: 'Self-Neglect / Withdrawal',  share: 10, mod: 0 },
  cruelty:   { label: 'Small Cruelties',            share: 5,  mod: 2, needsSecond: true },
  setback:   { label: 'A setback',                  share: 16, mod: 1 },   // progress undone: likelier the more she has to lose
};

// ── What she says about her standing, and what she says when she keeps something back ──
// `false` lines are claims that don't match.
const GRADE_LINES = {
  'On Track': [
    'classes are actually fine right now. shocking, i know',
    'midterm came back better than i deserved. taking the win',
    'academically i am thriving. socially, unclear',
  ],
  'At Risk': [
    'not gonna lie, i’m behind in two classes. working on it',
    'grades have slipped. i know. i’m dealing with it',
    'i’m on the edge with one class and i’d rather not talk about which',
  ],
  'Failing': [
    'i’m failing. there, i said it. i don’t know how to fix it yet',
    'academic standing is bad. properly bad. that’s the update',
    'i got the letter about my GPA. i haven’t opened it. i know what it says',
  ],
};
const GRADE_FALSE = [
  'grades are fine!! all caught up :)',
  'academically? never better. don’t worry about me',
  'classes are handled. genuinely nothing to report there',
  'all good on the school front. promise',
];
const COVER_POSTS = [
  'long day. nothing much to report.',
  'quiet one tonight. heading to bed.',
  'all good here. see everyone tomorrow',
  'usual sort of day. that’s about it',
  'nothing to say really. night x',
];

// ── The message (the direct-message composer) ────────────────────
// What the sister is sent says how she is to arrive (the clothing) and nothing about the correction itself: position, implement, severity and length only decide
// where the scene begins (`strength` and `pace` / `run` are indices into scene.js STRENGTH, PACE and RUN), and every one of them is changeable once she is in the room.
// `look`: what she is wearing when she comes (bodies.js: 'day' or 'sleep'); `layers`: lowered? { bottoms, briefs }.
const TROUBLE_OPENERS = ['{Name}. I saw your post.', '{Name}, we need to talk about tonight.', '{Name} — come find me.'];
const ROUTINE_OPENERS = [
  '{Name}. Nothing to report — Probation doesn’t care.',
  '{Name}, good night or not, you know how this works.',
  '{Name} — quiet evening. Doesn’t get you out of anything.',
];
const OWN_OPENERS = {
  lila: { trouble: ['{Name}. Come find me. You don’t have to say it’s fine.'], routine: ['{Name}. Nothing to report. That’s not the same as nothing to say.'] },
  taylor: { trouble: ['{Name}. Not “fine”. Come find me.'], routine: ['{Name} — nothing to report. Come anyway. I’ll ask how you actually are.'] },
  hannah: { trouble: ['{Name}, come find me. There’s room. There’s always room.'], routine: ['{Name}, quiet night. Come down anyway. You don’t have to ask.'] },
  jess: { trouble: ['{Name}. Whatever the reasonable explanation is, save it for my room.'], routine: ['{Name} — suspiciously quiet. Doesn’t get you out of anything.'] },
  marcy: { trouble: ['{Name}. I noticed. Come find me.'], routine: ['{Name}, nothing to report. I’m noticing you anyway.'] },
  sloane: { trouble: ['{Name}. This isn’t a negotiation. Come find me.'], routine: ['{Name} — nothing to report. Same rules. Same time.'] },
};
const CLOSERS = ['My room. Ten minutes.', 'The study. Now.', 'Common room’s clear tonight. Come down.'];
const CLOTHING = {
  clothed: { label: 'Clothed', clause: 'Come as you are, and keep it on: whatever you’re wearing, it stays on tonight.', look: 'day', layers: { bottoms: false, briefs: false } },
  baseline: { label: 'Sleepwear', clause: 'Change into something to sleep in.', look: 'sleep', layers: { bottoms: true, briefs: false } },
  bared: { label: 'Bared', clause: 'Wear whatever you like. It won’t matter: you’re getting it on the bare tonight.', look: 'sleep', layers: { bottoms: true, briefs: true } },
};
// Where the scene begins: how hard, and how long (indices into STRENGTH, PACE and RUN).
const SEVERITY = {
  goeasy: { label: 'Go Easy', strength: 1 },
  lighter: { label: 'Lighter Hand', strength: 2 },
  firmer: { label: 'Firmer Hand', strength: 4 },
  nomercy: { label: 'No Mercy', strength: 5 },
};
const LENGTH = {
  quick: { label: 'Quick', pace: 4, run: 1 },
  drawn: { label: 'Drawn Out', pace: 1, run: 3 },
  held: { label: 'Held Til It Lands', pace: 1, run: 4 },
};
// What follows the correction (aftercare), as the message the Big sends once it is decided.
const AFTER_CLAUSE = {
  corner: 'Bring a book. You’re standing in the corner after.',
  lines: 'Bring paper and a pen. You’re writing lines when we’re done.',
  held: 'I’ll hold you after, as long as you need.',
  warm: 'There’s tea after. This isn’t only punishment.',
};
const REPRIEVE_LINES = {
  stern: [
    '{Name}. I saw your post. I’m not thrilled, but this isn’t a correction night. Do better.',
    '{Name}, that’s not like you. I expect better tomorrow. That’s all I’ll say about it.',
    'I saw it. I’m letting it go this once — don’t make a habit of it.',
    '{Name}. Noted. I’m not happy, but I’m not calling you down for it either.',
  ],
  kind: [
    'Hey. I saw your post. You’re not in trouble — I just want to check on you.',
    'Come find me. Nothing heavy, I promise. I just want to see you.',
    'I read what you posted. Come sit with me for a bit?',
    '{Name}. I saw. However you’re doing tonight, I’ve got you.',
  ],
  reflection: [
    '{Name}. Before we talk — write down what happened tonight, in your own words. Send it to me.',
    'I saw your post. I want to hear it from you first — write it out, send it over, and we’ll go from there.',
    'Not tonight, but I want your side in writing. Take your time. Send it when you’re ready.',
  ],
};

// ── Reprieves and aftercare ─────────────────────────────────────
// A reprieve replaces the correction for the evening; aftercare comes after one. `cost` is spent from the
// evening's candle (see rules.js EVENING_CANDLE). Effects are in rules.js.
const REPRIEVES = {
  stern:      { name: 'A Stern Word',       cost: 2, blurb: 'Say it plainly and send her off. Wilfulness down a little.' },
  kind:       { name: 'A Kind Word',        cost: 2, blurb: 'Sit with her and listen. Valued and Satisfaction up.' },
  reflection: { name: 'Written Reflection', cost: 2, blurb: 'Pen and paper; she thinks it through. Composure up, Wilfulness down a little.' },
};
const AFTERCARE = {
  corner: { name: 'Corner Time', cost: 1, blurb: 'A few quiet minutes facing the wall. Composure up; if she feels unvalued it stings instead.' },
  lines:  { name: 'Lines',       cost: 1, blurb: 'Careful, attentive work. Composure and Attention up, no downside.' },
  held:   { name: 'Held After',  cost: 2, blurb: 'You stay with her until it eases. Valued up, Resentment down.' },
  warm:   { name: 'Warm Words',  cost: 1, blurb: 'Something kind, once it is over. Valued and Satisfaction up.' },
};

// ── The president, and the pinned post ───────────────────────────
// Every line names the sister: the morning message runs several of these back to back.
const PRES_FEEDBACK = {
  well: [
    'Good call on {Name} last night. That felt right.',
    '{Name}’s report actually matched the crime, for once. Nice work.',
    'That was well judged with {Name}. Keep going like that with her.',
    'You read {Name} right last night. That’s the standard.',
  ],
  under: [
    'You went easy on {Name}. She noticed, and so did I.',
    'That was lighter than what {Name} actually did. Might want to reconsider next time.',
    'I don’t think {Name} felt that one at all.',
    '{Name} walked away from that one unbothered. That’s not the idea.',
  ],
  over: [
    'That seems like a lot, for what {Name} actually did. Worth thinking about.',
    '{Name} didn’t do anything to deserve that. Ease up.',
    'You came down harder on {Name} than the report called for. I trust your judgment, but keep an eye on that.',
    'Whatever {Name} did, it wasn’t worth that. Dial it back.',
  ],
  reprieveEarned: [
    'Noted — {Name}’s getting a pass this time.',
    'You let {Name} off easy last night. Your call.',
    'No correction for {Name}, then. I’ll take your word that it was the right read.',
  ],
  reprieveUnearned: [
    'You let {Name} off with a Kind Word, and she’d earned worse than that.',
    '{Name} needed a correction last night, not a pass. Don’t make a habit of that.',
    'I read {Name}’s report. That wasn’t a kindness night, and you treated it like one.',
  ],
  // Used instead of a graded line when she is Cleared on that same night — critiquing the night a sister gets released reads as a mixed signal.
  cleared: [
    'And {Name} — that’s her done. Standards signed off this morning.',
    '{Name}’s clear. However you got her there, you got her there.',
    'That’s {Name} off Probation. She came a long way; I hope she knows who took her there.',
  ],
};
const GREETINGS = ['Morning. Read your report from last night.', 'Morning — report’s in, I went through it.', 'Morning. I had a look at last night’s log.'];
const PINNED_POST = {
  author: 'president', handle: '@president', initial: 'ΩΤΚ', tag: 'Pinned by the house',
  text: 'Reminder to all Bigs: Probation reports are logged nightly. No exceptions, good night or bad. If she’s on the list, she hears from you before lights out — that’s the whole point of the list.',
};
const MEMO = {
  org: 'Omega Tau Kappa · Standards Committee', title: 'Big Assignment', sub: 'Confidential · Chapter Record',
  issued: 'this term, week four', re: 'three (3) members currently on Social Probation',
  body: ['You are hereby assigned as Big to the members listed below, each of whom is currently on Social Probation pending review by this committee.', 'Probation reports are to be logged nightly for the duration. Their files follow.'],
  foot: 'This assignment takes effect immediately and is not subject to appeal.', sig: '— Standards Committee, ΩΤΚ',
};

// ── Things people say. {Title} {Name} ───────────────────────────
const SAYINGS = {
  well:    ['"Yes, {Title}. I understand."', '"…Thank you, {Title}. I needed that."', '"That was fair. I know it was."'],
  under:   ['"Is that all, {Title}?"', '"Oh. Is that — are we done?"', '"I’d braced for more, {Title}."'],
  over:    ['"That was… more than I needed, {Title}."', '"I’d have listened with less, {Title}."', '"It’s over. Please can it be over."'],
  harsh:   ['"Stop — please, {Title}. Please."'],
  word:    ['"{Title}. Red. I’m calling it."'],
  nothing: ['"…Oh. All right, {Title}."'],
};

// ── Scenes: the goodbyes ─────────────────────────────────────────
// Each is a few beats shown over the room with the sister standing in it. A beat is narration (`n`), the sister speaking (`r`), or a choice for the
// player (`ask`): each option has what you say (`you`) and her answer (`r`). Nothing in either scene lets the player talk anyone out of leaving: the
// word is honoured, and being Cleared is the end of a good story. {Title} {Name} {Subj} {Obj} {Poss}
const SCENES = {
  moveon: {
    open: [{ n: 'Standards has signed off. {Name} is waiting by the door of your room with her bag over her shoulder, and has been for some time. The house is very quiet.' }],
    lila: {
      r: '"I asked for something today, {Title}. A night off, actually. I said it out loud before I could talk myself out of it."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you. You know that."', r: '"I think I believe you. That’s the strange part. I think I actually believe you."' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Answer a text the same day. Even the ones that make me nervous."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"That sounds like a line," {Subj} says. Then: "No. It doesn’t. Thank you."' },
      ],
      end: '{Name} takes out her phone in the corridor, thumbs a message, and sends it before she can reconsider.',
    },
    taylor: {
      r: '"I told someone before it got bad, {Title}. I want that on the record. That’s a thing I did."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you."', r: '"Say it again and I’ll cry in the hallway, and I have mascara on."' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Eat lunch. A whole one, at a table. And tell somebody when the midterm is, before the night before."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"Look at me, not even hovering in the doorway." {Subj} laughs, and means it differently than {Subj} used to.' },
      ],
      end: '{Name} crosses the threshold without hovering, and for once does not look back to see whether anyone minds.',
    },
    hannah: {
      r: '"Can I say something before I go, {Title}? I want to finish the sentence this time."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you."', r: '"Thank you. I think I’m a bit proud of me. That’s new."' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Tell Jess I’m coming to movie night. Not asking if there’s room. Telling."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"I’m not in the way," {Subj} says, and it isn’t a question.' },
      ],
      end: '{Name} goes down the stairs with her shoulders level, and does not look back to see whether anybody noticed.',
    },
    jess: {
      r: '"I had a whole bit prepared, {Title}. I’ve decided to say thank you instead, which is much less funny."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you."', r: '"Careful. I’ll get a big head, and then you’ll have to do all this again."' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Go to bed at a reasonable hour, once, to see what it’s like. Then chaos. But with a sign-in sheet."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"No joke. See? Growth." {Subj} grins, and means it.' },
      ],
      end: '{Name} whistles all the way down the hall, and stops, and just walks. Quietly, for once, and on purpose.',
    },
    marcy: {
      r: '"Behave," {Subj} says, to the room in general. Then, drily: "I’m told this is where I say something."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you."', r: '"Noted. I felt that. It’s a strange thing to feel. Say it again?"' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Open the committee folder. Close it. Open it again tomorrow, which is the part I used to skip."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"Night, {Title}." It is a fond, unpointed word.' },
      ],
      end: '{Name} goes out sideways, as she does everything, and is smiling at the carpet before the door has clicked.',
    },
    sloane: {
      r: '"I’m told this is the part where I say I’ve been unreasonable, {Title}. I have. I’d like to say it properly."',
      ask: [
        { label: 'Tell her you are proud of her', you: '"I’m proud of you."', r: '"Don’t. I’ll start thinking I’ve earned it, and I haven’t. Yet."' },
        { label: 'Ask what she will do first', you: '"What will you do first?"', r: '"Pay the house car back. Sign it out, next time. And ask, out loud, and mean it."' },
        { label: 'Just open the door', you: '(You open the door, and hold it.)', r: '"You said no and it held. I didn’t know that could happen."' },
      ],
      end: '{Name} stops in the doorway, sets the house-car keys down on the desk with a small sound, and goes without taking a thing she hasn’t earned.',
    },
  },
  // The safe word ("Red"), used for the last time. Whatever you say, it is honoured; the options only colour the farewell.
  word: {
    why: {
      harsh: '{Name} has stopped, and is standing up out of position. {Subj} is trembling a little, and perfectly clear.',
      worn: 'Late in the evening {Name} is standing at the door of your room, with her bag already packed. It is not a decision made in a hurry.',
    },
    r: '"{Title}. Red. I’m calling it."',
    n: 'It stops, entirely, the way it was always going to.',
    ask: [
      { label: 'Thank her for telling you', you: '"Thank you for telling me. Of course. It’s done."', r: { willing: '"Thank you for stopping. I mean it."', sullen: '"…Thank you. I wasn’t sure you would."', cheeky: '"Good. I wasn’t sure how I’d say it twice."', flustered: '"Thank you — thank you. I’m sorry, I’m not — thank you."', plain: '"Thank you. That’s all I needed."' } },
      { label: 'Ask if she needs anything before she goes', you: '"Is there anything you need before you go? Anything at all."', r: { willing: '"A glass of water, if it’s no trouble. And ten minutes on my own."', sullen: '"Nothing. Just the door, please."', cheeky: '"My shoes. And a bit of quiet, which I know isn’t like me."', flustered: '"Somewhere to sit. For a minute. Then I’ll go."', plain: '"A moment on my own, and my jacket."' } },
      { label: 'Step back and open the door', you: '(You step back, and open the door for her.)', r: { willing: '"…Thank you, {Title}."', sullen: '{Subj} goes through it without a word, which is its own kind of answer.', cheeky: '"Nice manners." It’s not quite a joke.', flustered: '{Subj} nods, over and over, and cannot seem to stop.', plain: '{Subj} nods once, and goes.' } },
    ],
    end: {
      lila: '{Name} takes her bag and goes without a word, which is how she has always left. Nobody holds it against her.',
      taylor: '{Name} goes out with a joke half-formed that she does not make, and it is the quietest she has ever been.',
      hannah: '{Name} goes without asking whether it is all right to. It is, and nobody holds it against her.',
      jess: '{Name} does not look back and does not whistle, and is down the hall before the door has closed.',
      marcy: '{Name} goes out sideways, as ever, and for once the room feels the lack of her.',
      sloane: '{Name} leaves the keys exactly where they were. That, at least, is new.',
    },
    last: 'Nothing is held against her, or written down. The house keeps no grudge; whatever she does next, she does it with a clean record.',
  },
};

// One-line narration for results that have none of their own.
const RESULT_LINES = {
  reprieve: {
    stern: 'You take {Name} aside and say it plainly, without raising a hand. {Subj} listens to every word, and does not look away.',
    kind: 'You sit down with {Name} and ask, and then you listen. It takes a long time, and by the end of it something has eased.',
    reflection: 'You put pen and paper in front of {Name} and leave {Obj} to it. For a long while the only sound in the room is the scratching of the pen.',
  },
  aftercare: {
    corner: '{Name} stands facing the wall, hands behind {Poss} back, and for a few quiet minutes there is nothing to do but think.',
    lines: '{Name} is set to copy out a page, carefully, and does it. Slowly the hand steadies.',
    held: 'You stay with {Name} until it eases, and nobody says much, and nobody needs to.',
    warm: 'Afterward you say something kind, and mean it, and {Name} lets the words in.',
  },
};

// ── Changing the scene: what the interlude tells, in order (implement, position, clothes). {Name} {Subj} {Obj} {Poss} {Title} {Impl} ─
// Tone: gentle (for the willing and the flustered), firm, stern (for the cheeky and the sullen) — set by how she is (rules.js fetchMood).
const CHANGE = {
  helpUp: {
    calm: 'You take {Name}’s hands and help {Obj} up from across your lap.',
    sore: 'You take {Name}’s hands and help {Obj} up from your lap; {Subj} comes up slowly, rubbing the sting out with the heel of a hand.',
    spent: 'You take {Name}’s arms and lift {Obj} gently up from your lap, and keep a hand on {Poss} elbow until {Subj} is steady.',
  },
  helpBack: 'You take {Name}’s hand and help {Obj} back down across your knees, and settle {Poss} weight with a hand at the small of {Poss} back.',
  standOrder: { gentle: '"Up you get, {Name}, nice and slowly."', firm: '"Up. On your feet."', stern: '"Up, {Name}. On your feet. Now."' },
  stands: '{Name} gets up off your lap and straightens {Poss} clothes.',
  putDown: 'You set the {Impl} aside. Your hand will do.',
  selfFetch: 'You get up, go and fetch the {Impl} yourself, and say nothing about it.',
  selfBack: 'You come back with the {Impl}. {Name} has not moved.',
  backInPlace: '{Name} takes {Poss} place again.',
  position: {
    lap: { gentle: '"Come here, {Name}. Across my knee."', firm: '"Over my knee, {Name}."', stern: '"Over my knee. Don’t make me say it twice."' },
    case: { gentle: '"Over to the desk, {Name}, and lay your hands flat."', firm: '"The desk. Bend over it, palms flat."', stern: '"To the desk. Bend. Palms flat, and stay there."' },
    head: { gentle: '"Stand here in the middle of the room, {Name}, and put your hands on your head."', firm: '"Middle of the room. Hands on your head, fingers laced."', stern: '"Middle of the room. Hands on your head. And keep them there."' },
    chair: { gentle: '"Take hold of the seat of my chair, {Name}, and bend forward."', firm: '"Hold the seat of the chair. Bend."', stern: '"Hands on that chair, and bend. Do not let go."' },
    spread: { gentle: '"Feet apart a little, {Name}, and bend forward — hands on your thighs."', firm: '"Feet apart. Bend forward, hands on your thighs."', stern: '"Feet apart. Bend. Hands on your thighs, and hold it."' },
    hips: { gentle: '"Lie forward on the desk, {Name}, and take hold of the edge."', firm: '"Chest down on the desk. Hold the edge."', stern: '"Down on the desk. Hold the edge, and do not let go."' },
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
    case: '{Name} bends at the hips and lays {Poss} palms flat on the desk.',
    head: '{Name} stands in the middle of the room and laces {Poss} fingers on top of {Poss} head.',
    chair: '{Name} bends forward and takes hold of the seat of the chair.',
    spread: '{Name} widens {Poss} stance, bends forward, and settles {Poss} palms on {Poss} thighs.',
    hips: '{Name} lies forward across the desk, chest on the wood, and curls {Poss} fingers over the far edge.',
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

// A line from the subject each time the scene reopens: by how she is (mood), and how composed (band of distress).
const REOPEN = {
  willing: {
    calm: ['"I’m ready, {Title}."', '"Whenever you like, {Title}. I’m all right."'],
    warm: ['"I’m still here, {Title}. I’m listening."', '"That did sting. But I understand why, {Title}."'],
    edge: ['"I’m trying, {Title}. I’m really trying to hold on."', '"Please — I’ll be good, {Title}. I’m close to the end of it."'],
    past: ['"I can’t — {Title}, I’ve nothing left to give."'],
  },
  sullen: {
    calm: ['"Go on, then. Get it over with."', '"I haven’t said I’m sorry. Just so we’re clear."'],
    warm: ['"Don’t think that’s changed my mind."', '{Name} says nothing, but {Poss} breathing is not quite steady.'],
    edge: ['"Fine. FINE. I heard you."', '"That’s — enough. That’s enough, surely."'],
    past: ['"I’m done. I’m done, {Title}, I mean it."'],
  },
  cheeky: {
    calm: ['"Back already? I was just getting comfortable."', '"Go on, then, {Title}. I’ve had worse."'],
    warm: ['"Hardly felt it." (The voice is a little too bright.)', '"All right, that one I felt. Don’t let it go to your head."'],
    edge: ['"Okay — okay, point taken. Can we maybe not take it any further?"', '"I’ll behave, I will. Mostly. Truly."'],
    past: ['"Not funny any more, {Title}. Not funny at all."'],
  },
  flustered: {
    calm: ['"Sorry — sorry, I’m ready, I think. Am I ready?"', '"I’m all right, {Title}. I’m just — all right."'],
    warm: ['"Is that — am I doing it right, {Title}?"', '"It’s a lot. It’s a lot, but I’m here."'],
    edge: ['"I can’t think. I can’t think at all, {Title}."', '"Please, {Title}, I’ll do it properly, I promise, I will."'],
    past: ['"I’m sorry, I’m so sorry, I can’t — "'],
  },
  plain: {
    calm: ['"All right, {Title}. Go on."', '"I’m ready."'],
    warm: ['"I’m sore, {Title}. But I’m here."', '"I understand. Go on."'],
    edge: ['"I don’t know how much more I can take, {Title}."', '"I’m close, {Title}. Please."'],
    past: ['"No more, {Title}. Please. No more."'],
  },
};

// ── Afterwards: the scenes. By mood (rules.js fetchMood). `corner` and `lines` narrate how she is while it is done; `held` and `warm` are what the player says
// (calming words, kind words); `bed` is how she leaves the room, as it is read on the interstitial. {Name} {Subj} {Obj} {Poss} {Title} ─
const AFTER_SCENES = {
  corner: {
    willing: ['{Name} stands very still with {Poss} fingers laced on top of {Poss} head, and does not fidget once. By the end {Subj} is breathing evenly.', '"I’m thinking about it, {Title}. Properly." {Name} keeps {Poss} eyes on the join of the walls and means it.'],
    sullen: ['{Name} stares at the wall as though it owed {Obj} something. Somewhere around the third minute {Poss} shoulders come down a little.', '{Name} mutters something to the corner. It does not answer. After a while neither of them is angry.'],
    cheeky: ['{Name} counts the paint flecks under {Poss} breath, loses count, and starts again. Once, quite quietly, {Subj} giggles at the wall.', '"Is this the good corner? It’s a nice corner." {Name} falls silent a minute later, with the air of someone who has run out of material.'],
    flustered: ['{Name} fidgets for the first minute, and then, slowly, stops. The tension runs out of {Poss} shoulders a little at a time.', '{Name} whispers an apology to the wall, twice, and then simply breathes.'],
    plain: ['{Name} waits in the corner with {Poss} hands on {Poss} head, and the room goes quiet round {Obj}.', '{Name} stands there, and thinks, and lets it settle.'],
  },
  lines: {
    willing: ['{Name} bends over the page, tongue between {Poss} teeth, and writes every line as neatly as the first.', '"Nearly done, {Title}." {Name} does not hurry, and the last line is as careful as the first.'],
    sullen: ['{Name} writes with the pen pressed down hard enough to dent the page. The lines come out straight, all the same.', '{Name} scowls at the paper, and writes, and by the fourth page the scowl has gone slack.'],
    cheeky: ['{Name} writes the first lines in an enormous flourish, then in a cramped hand, then in a very good copy of someone else’s signature, and then settles down and does them properly.', '"Do they have to be joined up?" {Name} asks no one. They do. {Subj} joins them up.'],
    flustered: ['{Name} blots the first page and starts again, then again, and finally finds a rhythm and keeps it.', '{Name} writes, crosses a line out, and writes it again, and by the end {Poss} hand has stopped shaking.'],
    plain: ['{Name} writes steadily, and the only sound is the scratch of the pen.', '{Name} works down the page one line at a time, and does not look up until the last one.'],
  },
  held: {
    willing: ['"There. There now. You took it so well. It’s over, and I’m right here."', '"Breathe, {Name}. That’s it. You’ve done everything I asked, and I’m proud of you."'],
    sullen: ['"You don’t have to say anything. I’ve got you. It’s done, and nothing between us is changed."', '"Let it go, {Name}. You can be cross tomorrow. For now, just let me hold you."'],
    cheeky: ['"No jokes needed. It’s over, and you were braver than you’re letting on. Come here."', '"Shh. I know. I know. You’re all right, you’re all right."'],
    flustered: ['"Slowly. In — and out. There’s nothing more to do. It’s all done, and you’re safe."', '"Hush, now. You’re shaking. Let me hold you until it passes."'],
    plain: ['"It’s done, {Name}. It’s over. Breathe."', '"I’ve got you. Take your time. There’s no hurry at all."'],
  },
  warm: {
    willing: ['"You did well, {Name}. I want you to know that I see how hard you try, and it matters to me."', '"Thank you for taking it as you did. I think a great deal of you."'],
    sullen: ['"I know you don’t agree with me. I only want you to know that this is not the end of how I think of you."', '"You may be angry; that’s allowed. But you are not in trouble with me any more. We’re square."'],
    cheeky: ['"You’re a handful, {Name}, and I wouldn’t have you any other way. That’s over, and I’m glad you’re here."', '"Come on, then. Fair is fair: you took it, and now it’s done, and I’m fond of you."'],
    flustered: ['"You’re doing better than you think, {Name}. Truly. Look at me — it’s all right now."', '"It’s over, and you did nothing wrong in how you bore it. I’m not cross any more."'],
    plain: ['"That’s done with, {Name}. I won’t hold it against you, and I hope you won’t hold it against me."', '"You did what was asked. Thank you. We start fresh now."'],
  },
  bed: {
    willing: ['{Name} nods, murmurs "Goodnight, {Title}," and goes up quietly, the stair creaking in the dark.', '"Thank you, {Title}." {Name} squeezes your hand, goes up to bed, and does not look back.'],
    sullen: ['{Name} goes up without a word, and closes the door of her room a little harder than needed. After a minute the house is quiet.', '{Name} gives you one long look, and then goes to bed. There is no sound from upstairs.'],
    cheeky: ['"Night, then." {Name} salutes from the stairs, and goes up, and only winces a little on the top step.', '{Name} makes a face at the stairs, and then makes a better one at you, and goes to bed.'],
    flustered: ['{Name} stammers goodnight, gets halfway to the door, comes back to say sorry once more, and then finally goes up to bed.', '{Name} hurries up the stairs, and for a moment on the landing you hear {Obj} let out a breath.'],
    plain: ['{Name} says goodnight and goes up to bed.', '{Name} gathers {Poss} things, nods to you, and goes quietly up the stairs.'],
  },
};
// The narration that goes with what the player says in Held After and Warm Words (the words themselves are AFTER_SCENES.held / .warm).
const AFTER_NARR = {
  held: ['You wrap your arms round {Name} and draw {Obj} in, and {Subj} folds against you as the shaking eases. You speak low, close to {Poss} ear.', 'You hold {Name} for a long while, one hand slowly stroking {Poss} back, until {Poss} breathing comes level. Then you say quietly:', 'You take {Name} in against you and stay there, saying nothing at first. When {Subj} has stopped trembling, you murmur:'],
  warm: ['You sit back in the chair and wait until {Name} lifts {Poss} eyes to yours. Then, gently:', 'You hold {Name}’s gaze, and let a little of the sternness go out of your face. You say, kindly:', 'You look at {Name} for a moment, and your expression softens. You say:'],
};

// The last page of a game. `grown`: who a sister is when she is Cleared, from what Probation taught her. `lost`: why a bridge was broken, and what that may mean.
const EPILOGUE = {
  lila: {
    grown: 'Lila has found out that asking costs less than not asking. She answers messages the day they come, says when she needs the night off, and no longer performs "fine" for a room that never believed it. Out in the house she will be the one who tells the new members that it is all right to say so.',
    lost: 'Lila never quite believed the care was real, and the hand that came instead of the reason confirmed what she already feared. She left the way she always had: quietly, before anyone could say no. Out in the world she may keep performing ease, and keep being right that nobody asks what it costs.',
  },
  taylor: {
    grown: 'Taylor has learned that asking counts, and that it counts before it gets bad. She eats at tables, tells people when the midterm is, and is still the loudest laugh in the room, but now it costs her nothing. She will be the sister who notices when somebody else goes quiet.',
    lost: 'Taylor’s trouble was never the visible kind, and the house answered the visible kind. She left having been corrected for everything except the thing that was wrong. Out in the world she may keep waiting for it to get bad enough that someone steps in, and be too funny for anyone to notice in time.',
  },
  hannah: {
    grown: 'Hannah says no to a sister who asks her for something she should not, and does not apologise for it. She comes down to movie night without asking whether there is room. Out in the house she will be the quiet one who is quietly relied on, and knows it.',
    lost: 'Hannah moved easily in whatever direction she was pushed, and the house pushed her harder than it held her. She left having learned that being easy was not the same as being safe. Out in the world she may keep saying yes to whoever is kindest, and keep disappearing when the plans change.',
  },
  jess: {
    grown: 'Jess has found out what happens when something lands: nothing breaks. She keeps the guest list honest, the volume reasonable, and her cheerfulness exactly as it was. Out in the house she will be the warmth that does not need an audience.',
    lost: 'Jess tested every limit until she found one that held, and then could not forgive it for holding. She left certain that rules were only ever a game she had lost. Out in the world she may keep testing what she can get away with, and meet the consequence much later, and much harder.',
  },
  marcy: {
    grown: 'Marcy feels it now, and says so, drily. She opens the committee folder, and she finishes what is in it, and she can feel a deadline coming the way everyone else does. Out in the house she will be the sister who is noticed, and who notices.',
    lost: 'Nothing the house did reached Marcy, and so in the end nothing it said did either. She left unchanged and not unhurt. Out in the world she may keep sitting through the meeting and writing nothing down, waiting for someone to notice she has gone quiet.',
  },
  sloane: {
    grown: 'Sloane has been told no, and it held, and she is still standing. She signs out the house car, accounts for the budget, and listens when an officer speaks. Out in the house she will be a legacy who has earned the name, which is a better thing to be than she knew.',
    lost: 'Sloane met the first limit that held and could not accept that it was hers to meet. She left certain that the rules had been unfair, not firm. Out in the world she may keep spending what belongs to everyone, and keep being surprised when somebody finally says no.',
  },
};

root.OtkContent = { SCENES, STATS, STAT_NAMES, STAT_HINTS, CHARACTERS, ORDER, FIRST_THREE, CHORES, CHORE_STAT_NOTE, DUTY_LINES, ALONE_LINES, EVENTS, CATEGORIES,
  GRADE_LINES, GRADE_FALSE, COVER_POSTS, TROUBLE_OPENERS, ROUTINE_OPENERS, OWN_OPENERS, CLOSERS, CLOTHING, SEVERITY, LENGTH,
  AFTER_CLAUSE, REPRIEVE_LINES, REPRIEVES, AFTERCARE, PRES_FEEDBACK, GREETINGS, PINNED_POST, MEMO, SAYINGS, RESULT_LINES, CHANGE, REOPEN, AFTER_SCENES, AFTER_NARR, EPILOGUE };
if (typeof module !== 'undefined' && module.exports) module.exports = root.OtkContent;
})(typeof window !== 'undefined' ? window : globalThis);
