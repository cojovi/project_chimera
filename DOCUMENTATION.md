# Session notes — 2026-08-24 (brag reel)

## Decision
Produced a 30s vertical cinematic marketing Reel for Operation Kill Switch (`multiple` branch) via `/brag --tone cinematic --format vertical --duration 30 --voice`.

## Product truths used
- Branding: OPERATION KILL SWITCH; hero "IF THE CLOCK HITS ZERO, IT SENDS"
- Wall: ACTIVE PROTOCOLS + mock callsigns NIGHTHAWK / VESPER / IRONVEIL / LONGHORN
- Enlist: ENLIST NEW OPERATOR; CHECK IN → CHECK-IN CONFIRMED — CLOCK RESET
- T-zero: T-ZERO REACHED / PAYLOAD RELEASED // SWITCH EXPENDED
- AES-256 encrypted at rest (not E2E); server-side cron; 10% reminder once per cycle
- No production URL in repo — CTA is "BUILD YOUR FAILSAFE" without a link

## Creative choices
- Concept-first hook (movie trope), then multi-user wall, then personal loop
- VO: Kokoro `am_michael` @ 0.92 (21.9s), music bed ducked low (bundled tracks are upbeat; kept quiet so they don't fight the thriller tone)
- Recreated real UI in Hyperframes HTML rather than inventing features

## Outputs
- `brag-output/brag.mp4`
- `brag-output/brag.jpg` (thumbnail from 4.8s "SEND EVERYTHING" beat)
- `brag-output/brag-plan.md`, `composition-brief.md`, `share-copy.txt`, `share-copy-variants.md`
