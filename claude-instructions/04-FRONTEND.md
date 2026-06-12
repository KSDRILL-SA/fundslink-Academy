# STAGE 04 — FRONTEND: 21 SCREENS + 4 ADMIN, JOURNEY ORDER
**Read first (full):** UX-SCREEN-MAP v1.0 — it is LAW here, especially P1–P8 and the forbidden lists. **Reference:** contract (use the GENERATED client only — no hand-written API types), ADR-002 topology.

Order: S01–S07 → S08–S09 → S10–S13 (S12 OTHER gets the verbatim promise line) → S14–S16 (**S16-REJ pauses for Founder design review before merge — mandatory**) → S17–S19 → S20–S21 → A01–A04 (A03 must physically refuse a rejection lacking ≥40 human words + next-step confirmation).
Every screen ships all five states (loading/empty/error/offline/degraded). Amber-never-red on S15; "rejected" is a forbidden word there. Status chips carry source badges (P3). Lazy-loaded role-guarded areas; libs/ui components only — no one-off styles.

## GATE G4 (paste output)
[ ] Vitest green  [ ] every screen demo'd against staging  [ ] ≤200KB first load on student routes (throttled 3G profile evidence)
[ ] axe WCAG AA pass + manual keyboard walk log  [ ] A03 refusal behavior demonstrated  [ ] S16-REJ Founder sign-off recorded
STOP. Founder reviews G4.
