# Hyperframes Composition Brief: PROTOCOL CHIMERA

## Objective
A 30-second vertical cinematic **consumer marketing reel** for Protocol Chimera. Sell the movie dead-man's-switch, then the fact that anyone can create their own. Not a developer portfolio piece.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Poster: `brag-output/brag.jpg`
- Format: vertical — 1080×1920
- Duration: 30 seconds

## Source Material
- Project root: `/Volumes/FastSSD/github/test/project_chimera`
- Branch: `multiple`
- Primary files: `src/App.tsx`, `src/components/{TimerWall,AuthPanel,Console,Countdown}.tsx`, `src/index.css`, `tailwind.config.js`, `index.html`, `README.md`
- Product name: **PROTOCOL CHIMERA** (header PROTOCOL / CHIMERA)
- Strongest claim: **IF THE CLOCK HITS ZERO, IT SENDS**
- Key UI: public callsign wall, enlist form, personal countdown, ARM SWITCH, CHECK IN, payload vault, T-zero expended state
- Copy that must appear verbatim (or as the UI actually renders it):
  - PROTOCOL CHIMERA
  - IF THE CLOCK HITS ZERO, IT SENDS
  - ACTIVE PROTOCOLS
  - ENLIST NEW OPERATOR
  - ARM SWITCH / ARMED
  - CHECK IN
  - CHECK-IN CONFIRMED — CLOCK RESET
  - AES-256 ENCRYPTED AT REST
  - T-ZERO REACHED
  - PAYLOAD RELEASED // SWITCH EXPENDED
  - BUILD YOUR FAILSAFE

## Creative Direction
- Tone preset: cinematic
- Direction: classified intelligence terminal / spy-thriller, grounded in the real UI
- Interpretation: slow push-ins, giant type, amber CRT, one idea per beat, VO almost whispered
- Angle: the movie trope is now a multi-operator service you can join
- Hook: "You know that thing in movies…" over a live countdown
- Outro: BUILD YOUR FAILSAFE / PROTOCOL CHIMERA
- Avoid: SaaS jargon, stack names, fake URLs, E2E/zero-knowledge claims, destruction/weapons, "trusted by thousands", generic hacker rain

## Visual Identity
- Background: `#06070a`
- Text: `#8b93a7`
- Accent: `#ffb300`
- Alarm: `#ff2b2b`
- Armed: `#3dff88`
- Display font: Michroma
- Body font: IBM Plex Mono
- Visual references: CRT scanlines, HUD corners, tabular countdown, callsign cards, amber lamp, red T-zero

## Storyboard
Use `brag-output/brag-plan.md`.

1. Trope — 3.2s — movie setup + giant clock
2. The deal — 3.4s — IF I DON'T CHECK IN / SEND EVERYTHING
3. Reveal — 3.0s — real product chrome + hero line
4. Wall — 3.6s — four live callsigns
5. Yours — 3.8s — enlist + ARM SWITCH
6. Payload — 3.4s — vault + recipients
7. Check-in — 3.4s — CHECK IN + clock reset
8. Miss — 4.2s — T-zero / payload released
9. CTA — 3.6s — browser closed, clock continues, BUILD YOUR FAILSAFE

## Audio
- Role: cinematic support
- Arc: quiet intrigue → pulse → arm → confirm → impact → held CTA
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` at very low volume (this library is upbeat; treat it as a ticking bed, not a jingle)
- Music treatment: start ~0s, volume ~0.12, duck to ~0.06 under VO, fade last 1.2s
- Cue source: bundled preset `happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`
- Strong locks (≤3): product reveal ~8.74, T-zero **22.93**, optional ARM ~13.11. Skip if they hurt VO/readability.
- Audio-reactive: subtle amber glow / scanline opacity from RMS. No visualizer.
- Audio-coupled moments:
  - countdown ticks
  - ARM SWITCH
  - CHECK IN confirm
  - T-zero
- Voiceover: required. Generate with `npx hyperframes tts`. Voice: `am_michael` (calm male). Speed ~0.92.
- VO script: see brag-plan.md
- Duck music under VO
- SFX: sparse interface/impact after animation exists
- Copy selected audio into `brag-output/composition/assets/`

## Hyperframes Instructions
- Recreate the real UI in HTML (no live capture required)
- Vertical 1080×1920, 30s
- Readable type (hold floors)
- Show actual product chrome, not generic cybersecurity stock
- Lint + validate before render
- Poster frame should read **IF I DON'T CHECK IN / IT SENDS** even paused
- No invented production URL
