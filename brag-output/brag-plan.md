# Brag Plan: PROTOCOL CHIMERA

## 1. What is the app?

Protocol Chimera is a multi-user dead man's switch. An operator creates an account, uploads files, names recipients, arms a server-side timer, and checks in. Miss T-zero while armed and the payload is decrypted and emailed automatically — even if the browser is closed.

## 2. Funniest / most impressive claim?

The movie line is now a product: **"If I don't check in, send everything."** Real UI: **IF THE CLOCK HITS ZERO, IT SENDS.**

## 3. Visual hook?

Giant amber CRT countdown (`00:00:14:07`) on black, then the public **ACTIVE PROTOCOLS** wall of callsigns (NIGHTHAWK, VESPER, IRONVEIL, LONGHORN).

## 4. What should be shown from the actual UI?

- Landing hero: `IF THE CLOCK HITS ZERO, IT SENDS`
- Public wall: `ACTIVE PROTOCOLS — N SWITCHES LIVE` + mock callsigns
- Enlist: `ENLIST NEW OPERATOR` / email / callsign / passphrase / `ENLIST + OPEN CONSOLE`
- Console: callsign + `ARMED`, `ARM SWITCH`, `CHECK IN`
- Flash: `CHECK-IN CONFIRMED — CLOCK RESET`
- Payload: `DROP FILES OR CLICK TO ADD` + `AES-256 ENCRYPTED AT REST`
- Delivery: `PRIMARY RECIPIENT` / `CC RECIPIENTS`
- T-zero: `T-ZERO REACHED` / `PAYLOAD RELEASED // SWITCH EXPENDED`

## 5. Shortest satisfying video?

User requested **30s** vertical (override of the 15–25s default) so the conversion story can land: trope → wall → yours → check-in → miss → server-side → CTA.

## 6. Tone?

- Preset: **cinematic**
- Direction: intelligence-thriller / classified terminal. Calm, slightly conspiratorial VO. Real UI is the star. Not a developer showcase.

## 7. Audio?

Cinematic support. Bundled vol-12 bed (least punchy of the pack) kept **very low** under VO so it reads as pulse, not "happy business." Sparse SFX: tick, arm, click, confirm, T-zero impact. Voiceover on. Subtle audio-reactive amber glow only.

## 8. Share caption (draft)?

You know that thing in movies — if I don't check in, send everything? Protocol Chimera is that, for real. Build your own dead man's switch.

## 9. User flow worth showing?

Enlist (callsign) → ARM SWITCH → payload + recipients → CHECK IN (clock resets) → miss T-zero → PAYLOAD RELEASED. Differentiator: close the browser, the clock keeps running.

---

## The angle

Sell the **movie dead-man's-switch** first. Then reveal you can **create your own** on a live wall of operators. Conversion, not stack.

## Hook (0–3s)

Black. Super: **YOU KNOW THAT THING IN MOVIES…** Cut to a huge Chimera countdown. VO: "You know that thing in movies…"

## Key moments

1. Trope lock: **IF I DON'T CHECK IN / SEND EVERYTHING**
2. Wall of live callsigns — this is a network, not one person's toy
3. Enlist + ARM SWITCH → ARMED
4. Files / recipients / deadline
5. CHECK IN → clock reset
6. T-zero → PAYLOAD RELEASED
7. Browser closes; clock continues — **SERVER-SIDE FAILSAFE**

## Outro / punchline

**BUILD YOUR FAILSAFE.** Wordmark PROTOCOL CHIMERA. No invented URL (none in repo).

## Visual identity (from the project)

- Background: `#06070a` (`void`)
- Panel: `#0b0d12`
- Text: `#8b93a7` (`steel`)
- Accent: `#ffb300` (`amber`)
- Alarm: `#ff2b2b`
- Armed: `#3dff88`
- Display: Michroma
- Mono: IBM Plex Mono
- CRT scanlines, HUD corners, amber glow, tabular countdown

## Accurate claims only

- AES-256 encrypted at rest (server-side key — not E2E / zero-knowledge)
- Server-side cron (every minute); browser does not need to stay open
- 10% remaining reminder, once per cycle
- Signup currently open; do not say hardened / enterprise / thousands of users
- Does not destroy anything — it **releases** a pre-chosen payload

## Voiceover script

Calm, close-mic, not a trailer announcer:

> You know that thing in movies. If I don't check in… send everything. Yeah. You can actually do that. Every operator gets their own failsafe. Create your protocol. Your files. Your recipients. Your deadline. Check in… and the clock resets. Don't… and Chimera takes over. The failsafe runs without you. Build yours.

## Audio direction

- Role: cinematic support (VO primary)
- Music: vol-12 at ~0.10–0.14, ducked under VO to ~0.06
- Music cue guidance: 8.74s (product reveal), 13.11s (arm), 17.47s (check-in), 22.93s (T-zero). ±0.15s. Story > beat.
- Audio-reactive: subtle amber glow / tick pulse from RMS. No EQ bars.
- SFX: sparse, motion-matched
- Restraint: no glitch circus, no happy-corporate energy in the mix

## Storyboard (30.0s vertical 1080×1920)

### Scene 1 — Trope — 0.00–3.20s
Black → super **YOU KNOW THAT THING IN MOVIES…** then giant amber countdown filling the frame.
Sequential: line, then clock.
Audio: VO open, faint tick.
Transition: hard cut → 2

### Scene 2 — The deal — 3.00–6.40s
**IF I DON'T CHECK IN…** / **SEND EVERYTHING.**
Hold for read.
Audio: VO completes the movie line.
Transition: dramatic scale into product → 3

### Scene 3 — Reveal — 6.20–9.20s
Real header **PROTOCOL CHIMERA** + hero **IF THE CLOCK HITS ZERO, IT SENDS**.
Audio: "Yeah. You can actually do that." Strong cue ~8.74s.
Transition: wipe down to wall → 4

### Scene 4 — Live wall — 9.00–12.60s
**ACTIVE PROTOCOLS — 4 SWITCHES LIVE**. Cards: NIGHTHAWK, VESPER, IRONVEIL, LONGHORN with independent clocks. Slow push + lateral drift.
Audio: "Every operator gets their own failsafe."
Transition: cut to enlist → 5

### Scene 5 — Make it yours — 12.40–16.20s
**ENLIST NEW OPERATOR** (email / callsign NIGHTHAWK / passphrase) flash, then console **ARM SWITCH** → **NIGHTHAWK :: ARMED**.
Sequential: form → arm → armed lamp.
Audio: "Create your protocol." Cue ~13.11s on ARM.
Transition: cut to vault → 6

### Scene 6 — Payload — 16.00–19.40s
Vault dropzone **DROP FILES OR CLICK TO ADD** / **AES-256 ENCRYPTED AT REST**. Then delivery **PRIMARY RECIPIENT**. Overlay: **YOUR FILES. YOUR RECIPIENTS. YOUR DEADLINE.**
Audio: matching VO.
Transition: cut to check-in → 7

### Scene 7 — Check-in — 19.20–22.60s
Personal countdown running. Finger/cursor hits **CHECK IN**. Flash **CHECK-IN CONFIRMED — CLOCK RESET**. Digits jump forward.
Audio: "Check in… and the clock resets." Cue ~17.47s is early — lock check-in to ~19.66 if needed; prefer story.
Transition: urgency ramp → 8

### Scene 8 — If you don't — 22.40–26.60s
Clock drains into alarm red. **00:00:00:00**. **T-ZERO REACHED**. **PAYLOAD RELEASED // SWITCH EXPENDED**.
Audio: "Don't… and Chimera takes over." Beat-lock T-zero to **22.93s**.
Transition: browser chrome closes → 9

### Scene 9 — Server-side + CTA — 26.40–30.00s
Browser frame collapses. Clock keeps ticking in the dark. **CLOSE THE BROWSER.** / **THE CLOCK DOESN'T CARE.** Then wordmark + **BUILD YOUR FAILSAFE.**
Audio: "The failsafe runs without you. Build yours." End cue ~24.56 unused if it fights the hold — hold the CTA.

**Music mood:** cinematic (bed is a pulse, not the personality)
**Audio summary:** Whispered trope → low pulse → arm click → check-in confirm → T-zero hit → quiet CTA.

## Share copy (draft)

You know that thing in movies — if I don't check in, send everything?
Protocol Chimera is that, for real. Build your own dead man's switch.
