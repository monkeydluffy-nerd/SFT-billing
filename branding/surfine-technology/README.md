# Surfine Technology — S+T Monogram Concepts

Six original S+T monogram concepts, built as flat vector paths (SVG) — no gradients, no 3D, no shadows, no text-dependent artwork for the symbol itself. Each concept file is a full spec sheet showing: the symbol alone, symbol+wordmark (stacked), a horizontal lockup, a compact app-icon tile, and black-on-white / white-on-black versions.

Open any `.svg` file directly in a browser or in Illustrator/Figma/Inkscape to inspect and edit the paths.

## Files

- `overview-all-concepts.svg` — all six symbols side by side, for quick comparison
- `concept-1-spine-lock.svg`
- `concept-2-enclosed-seal.svg`
- `concept-3-geometric-interlock.svg`
- `concept-4-minimal-flag.svg`
- `concept-5-dual-bracket.svg`
- `concept-6-diagonal-fold.svg`

## The six concepts

**1 — Spine Lock.** The T's stem extends downward and becomes the literal spine that the S curve is built around, so the two letters share one structural line rather than sitting side by side. Monoline stroke construction (single consistent weight, rounded joins).

**2 — Enclosed Seal.** The Spine Lock construction contained inside a thin circular ring, like a coin or an official stamp. Reads immediately as "certified / official" — a natural fit for an invoicing-adjacent product, but the circle also adds a second visual layer to keep track of at very small sizes.

**3 — Geometric Interlock.** No curves at all — the S is drawn as a squared, right-angle stroke (like a stepped staircase) that shares its top horizontal bar with the T. Fully rectilinear, architectural, matches the "geometric and balanced" brief literally.

**4 — Minimal Flag.** Same spine idea as Concept 1, but with a much thinner stroke and a short flag-like T top instead of a full bar, maximizing negative space. Airier and lighter-weight than the others — reads more editorial than corporate.

**5 — Dual Bracket.** A thick vertical T-stem flanked by two offset quarter-circle brackets stacked to imply an S-rhythm without ever drawing a continuous S curve. More abstract and less immediately legible as "S+T" than the others, but distinctive as a pure geometric mark.

**6 — Diagonal Fold.** A single continuous ribbon-shaped path that starts as a T's top bar and folds down into an S-curve — one unbroken silhouette, no visible stroke/gaps at all (built as a filled shape, not a stroked line). Reads as flowing/directional without using a literal arrow, lightning bolt, or motion-line cliché.

## Recommendation — strongest 2 for a real corporate identity

**Concept 1 (Spine Lock) and Concept 6 (Diagonal Fold) are the strongest.**

- **Concept 1** is the most balanced all-rounder: the letterforms stay genuinely legible as both S and T even at favicon size, the monoline stroke reads as confident and modern without being trendy, and because it's a stroke (not a filled blob) it holds up equally well embossed on an invoice header, rendered as a small UI icon, or scaled up on a website hero. It's the safest, most "this could be a 20-year-old software company's mark" choice.
- **Concept 6** is the more distinctive of the two: because it's a single filled silhouette rather than a stroke, it reproduces perfectly at tiny sizes (no stroke-width rendering issues at 16×16 favicon scale) and has a slightly more premium, bespoke feel — it looks deliberately drawn rather than "constructed from two overlapping letterforms," which is the difference between a generic monogram and a real identity mark. The tradeoff is it takes about half a second longer to parse as "S+T" than Concept 1 does.

Concepts 2, 3, and 5 are all viable secondary directions (2 in particular would work well as a formal seal/certification mark for legal or compliance-facing documents specifically), but none beats 1 or 6 as the *primary* mark for the full identity system.

## Colors used

- Ink: `#12151A` (near-black, warmer than pure `#000000`)
- Navy: `#14304D`
- Restrained teal accent: `#1D6E8A`

All six concepts are shown in ink/black by default since the brief calls for the mark to be "strong in pure black and white" first — navy/teal are intended as an optional secondary treatment (e.g. navy wordmark with a black symbol), not a requirement.

## Suggested next step

Pick one primary concept (1 or 6, per the recommendation above) and I can:
- Produce a refined, final single-weight version tuned specifically for favicon/Windows `.ico` sizes (16/32/48/256px)
- Build the exact horizontal and stacked lockup files you'll actually use in the SFT Billing app header and on invoice templates
- Export flattened path versions (fully boolean-merged, no overlapping strokes) ready for a vector export pipeline