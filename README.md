# ΩΤΚ Companion

A companion to *Rules For A Girl Like Me*, reskinned as omegataukappa.social, the closed network of a sorority house. You are **Avery**, the Big (the only thing you can change is her name). The Standards Committee has put three sisters on Social Probation in your care. Each night you read what each of them posts, and answer with a direct message: a word, or a correction by hand in your room, and what comes after.

It is the Birchwood House game (the live-correction build, no cards) converted to the OTK Companion spec. It is built on the Starlight engine (`starlight-engine.js`, three.js r128 in `vendor/`).

**Everyone is an adult (19+) who joined the chapter of her own accord and understands what Probation is.** The safe word is **"Red"**: any call stops the scene at once and costs her (Valued −2, Satisfaction −1, Composure −1, Resentment +1); on the second or third call (two if Resentment is already 6 or more) she requests a new Big. Nothing overrides it.

## Run it

```
npm run serve        # then open http://localhost:8765/
npm test             # rules unit tests (Node, no dependencies)
npm run e2e          # browser smoke test, needs Playwright (see the header of tests/e2e-smoke.js)
```

No build step. Progress autosaves in `localStorage` (`otk.v1`).

## The flow

1. **Cold open.** The Standards memo (the three sisters' *official* write-ups only), then the login, then the app.
2. **Morning.** Day 1 shows the pinned post; every later day opens with **the president's response** to last night: one line per sister keyed to how it went, then a state-change block (Cleared, new sister assigned, requested a new Big). Then the **duty board**: drag or tap each sister onto a duty (the three paired duties take two).
3. **Evening.** A timeline with a post per sister, in her own voice. A **duty register** at the top is your own record of how each duty went and where each sister's Grades sit; her post may not say it the same way. The president's private note on an event post is the truth about it. A post stamped after 10 PM (in red) is a **Late Report**: a silent +1 on what she needs.
4. **The direct message.** Position, implement, clothing, severity and length build the message live, in a fixed order, or you offer a word instead (a stern word, a kind word, a written reflection). Nothing is locked until Send. These choices set where the correction *begins*; every one is changeable once she is in the room.
5. **The correction** is live in the Big's room: smack, run a number, stop whenever you like; change position, implement (a new one has to be fetched, which is a short exchange with her), clothing, pace and strength; four cameras. Her highest distress is scored against what she needed tonight. Afterwards: Corner Time, Lines, Held After, Warm Words or Sent to Bed.
6. **The Probation Report** is auto-compiled from what you sent. Submit, and it is morning.

## What was removed from the card game

No hand, no deck, no seven cards, no copies, no three-card cap and no reshuffle: every message option is always available, and the live correction replaces severity totals. The one scarcity left is Birchwood's **candle** (five marks an evening, spent on reprieves and aftercare), which stops "always offer a kind word" from being a solved game.

## What she needs tonight

| Band | Peak distress | Needed by |
|---|---|---|
| Minimal | < 0.2 | Wilfulness 1 |
| Light | 0.2 – 0.55 | Wilfulness 2–3 |
| Moderate | 0.55 – 0.9 | Wilfulness 4–5 |
| Firm | 0.9 – 1.2 | Wilfulness 6–7 |
| Severe | 1.2 – 1.5 | only with something on top |
| Too harsh | ≥ 1.5 | never; nothing more is struck |

On top of Wilfulness: a bad duty (+1), an event (+0 to +2), a late post (+1), and what she withheld or misreported (omitting something is 1, saying something untrue is 2; every two points are a band). At most three bands over her Wilfulness, never past Severe. A trap (she is hiding that she is not fine) needs the gentle answer. Match quality drives the stats as in the spec (well-matched / undershoot / overshoot).

## The sisters

Starting spreads and clearing thresholds are the spec's. Lila (needs trust first; over-correction reads as proof), Taylor (the trap: conceals rather than defies; Grades gate her release), Hannah (moves in any direction too easily; Satisfaction is slow), Jess (appetite; takes a firm hand if valued), Marcy (severity barely moves her; aftercare does), Sloane (entitlement; a reprieve early reads as no consequence). Their underlying truth is kept back until they are **Cleared**; Cleared sisters go to *Sisters in Good Standing* for good, and nobody who has been cleared or has left comes back. The game ends when everyone has; the score is how many were cleared. A sister is never cleared before three nights.

Descriptions come from the book's physical-description extract: it states almost nothing, so bodies keep what it does say (how each sister dresses and carries herself) and nothing it does not. Avery's only stated feature is that her eyes are "curious, unreadable".

## Layout

```
index.html            page shell
css/style.css         the app (paper, brass, oxblood) and the room's HUD
js/content.js         the cast, duties, posts and events, the message clauses, the president's lines, goodbye scenes (pure data)
js/rules.js           the rules (pure functions over JSON state; runs in Node)
js/edits.js           the editor's reports: parsing a pasted design or pose report
js/poses.js           pose edits (pasted from the editor's pose report)
js/room.js            the Big's room, the chair and the desk
js/bodies.js          the sisters' (and Avery's) bodies, as Starlight presets
js/scene.js           the live-correction wrapper: cameras, rebuild-in-place, layers, pace and strength, implements
js/ui.js              the app and the game flow
editor.html           the character editor (the Starlight viewer with this cast in place of the stock bodies)
tests/rules.test.js   unit tests for the rules, including a long simulated run
tests/e2e-smoke.js    two days in headless Chromium, including every live control
```

Implements: the hairbrush, the ping-pong paddle, her own paddle and the house paddle (the three paddles are the engine's paddle, lighter or heavier), and the hand.
