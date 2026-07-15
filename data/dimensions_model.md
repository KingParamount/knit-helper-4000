# The dimensions model

How `size + style + ease` becomes a set of **finished garment dimensions**, which are then
multiplied by gauge to get stitch/row counts. This is the stage between the size table and
the row array:

```
size + ease_style + style  ->  GarmentDimensions  ->  × gauge  ->  stitch/row counts  ->  Row[]
```

Guiding rule (from the user, updated 2026-07-16): **be guided by current (2026) best
practice.** The Knitware-extracted data is a *starting point* — kept where it is still the
best source (body measurements, option vocabulary, constraint geometry) but superseded by
modern public standards where those give better fit. This realigns with BRIEF.md, which
always said to derive grading "from first principles ... well documented in public knitting
literature." Every value is cited: to the manual where the original's choice still stands,
or to a public source (Craft Yarn Council, Ann Budd, Shirley Paden, Sister Mountain)
otherwise — never an unsourced guess.

## Units

Internal unit is **millimetres** (see `ease_model.md`). Body measurements come from the
chosen row's native values (cm ×10 or inch ×25.4). Display converts back to the user's
chosen unit; inches show as 16ths, not decimals.

## Gauge — four inputs, "per 4 in (10 cm)" (manual-confirmed)

The original works in **stitches and rows over 4 inches (= 10 cm)**, entered to one decimal
place (`manual.txt:1365` "gauges over 4 inches to the closest one decimal place, e.g. 28.4
stitches by 33.6 rows"; also `:818`, `:1095`). Four inputs:

| input | field | notes |
|---|---|---|
| body stitch gauge | `GaugeBodySt` | per 4 in |
| body row gauge | `GaugeBodyRow` | per 4 in |
| rib stitch gauge | `GaugeRibSt` | optional — 0 ⇒ use default rib calc (`manual.txt:1367`) |
| rib row gauge | `GaugeRibRow` | optional — 0 ⇒ use default rib calc |

Ribbing is knit tighter than the body, so it pulls in (`manual.txt:368`). If the knitter
gives no rib swatch, the original derives a default — that default rule is **not yet
recovered** (open item R1). Later, patterned sections add a 5th/6th gauge; the model leaves
room for that but Phase 1 ignores it.

## The ease application policy (resolved against 2026 standards)

Only the **chest** ease scales with the fit style. For a **set-in sleeve** the other widths
are **fixed allowances**, not fractions of the chest ease — a set-in armhole/sleeve is fitted
regardless of how loose the body is. (Validated on the way: CYC's standard *body*
measurements for a 36" woman match our size table — arm depth 7–7½" vs 7.5, upper arm 11 vs
10.75, hip 38–40 vs 38.)

| dimension | finished value | basis |
|---|---|---|
| **Chest** | `body_chest + base·ease_factor` (**bust-only**) | CYC fit ladder — very-close/close/classic/loose/oversized maps onto our five styles |
| **Back width** | `body_back_width + 0` | set-in shoulder seam sits on the shoulder tip → zero ease (Sister Mountain) |
| **Armhole depth** | `arm_depth + 1.5"` | Sister Mountain (set-in) |
| **Armhole (around)** | `2 × armhole_depth` | geometry (`manual.txt:257`, `:506`) |
| **Sleeve top** (upper arm) | `body_upper_arm + 1"` | Sister Mountain (set-in) |

Notes and remaining edges:
- **Bust-only, not larger-of-bust/hip.** CYC sizes to the bust; the original inflated to the
  hip for straight bodies (`:488`), which over-widened short garments (a "moderate" 36 wore
  like CYC "loose"). Hip clearance for *long* straight garments becomes a length-aware
  refinement (ties to L1), not a blanket chest inflation.
- **Set-in only.** These allowances are for a set-in sleeve. Drop / raglan / round-yoke use
  different back-width and armhole ease — future work.
- **Fixed, not style-scaled.** A truly oversized garment loosens the sleeve a little; the
  fixed allowances ignore that. Reasonable Phase-1 simplification, flagged.
- **Allowances are inch values.** Metric-native equivalents (Sister Mountain gives 2.5 cm and
  4 cm) are needed when the mm path is built — see M1 / `ease_model.md`.

Sources: Craft Yarn Council [body measurements](https://www.craftyarncouncil.com/standards/woman-size)
and [fit & ease](https://www.craftyarncouncil.com/standards/body-sizing);
Sister Mountain [set-in sleeve design](https://www.sistermountain.com/blog/design-knit-set-in-sleeve).

Lengths (body length, sleeve length) get **no ease-style ease** — the manual is explicit
that ease is applied to the four widths, "not to lengths" (`ease_model.md`, `manual.txt:325`).
They carry their own fixed comfort allowances, derived separately (open item L1).

## Open items (must be resolved or explicitly signed off before Phase 2)

- **R1 — default rib gauge / rib pull-in.** How the original sets rib width and the default
  rib gauge when no rib swatch is entered. `manual.txt:368`, `:1367` describe it qualitatively.
- ~~**E1 — per-dimension ease for back width / armhole / upper arm.**~~ **Resolved** against
  CYC + Sister Mountain (fixed set-in allowances above). Remaining minor edge: whether the
  allowances should scale mildly for oversized fits.
- **L1 — length allowances.** Body length and sleeve length comfort allowances.
- **N1 — neckline geometry.** Front/back neck width & depth defaults per neckline style
  (crew for the Phase-1 target). `manual.txt:429`, `:530-535` give partial defaults.
- **M1 — metric ease bases.** No metric worked examples exist; see `ease_model.md`.

## Phase-1 target (the "done" bar)

Woman 36", moderate ease, set-in sleeve, flat bottom-up, crew-neck pullover, at a stated
gauge → a complete, plausible `Row[]` for back, front and both sleeves with reconciling
stitch counts. The dimensions checkpoint (Woman 36" × five ease styles, finished chest
called out) gates everything after it.
