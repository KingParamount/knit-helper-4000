# The dimensions model

How `size + style + ease` becomes a set of **finished garment dimensions**, which are then
multiplied by gauge to get stitch/row counts. This is the stage between the size table and
the row array:

```
size + ease_style + style  ->  GarmentDimensions  ->  × gauge  ->  stitch/row counts  ->  Row[]
```

Guiding rule (from the user): **do what the original did.** Where the manual documents a
behaviour, follow it and cite the manual line. Where it genuinely doesn't, fall back to a
**named public knitting source** (Budd, Paden, Craft Yarn Council) and cite it — never an
unsourced guess. Every value below is tagged with its basis so sign-off is auditable.

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

## The ease application policy (the key open area)

Ease (`base[style] · ease_factor[size]`, per `ease_model.md`) is applied to four widths:
**chest, back width, armhole, upper arm** (`manual.txt:325`). The manual works a number
only for the **chest**. How much each *other* width gets is **not** settled by the manual.
So ease is applied per-dimension via this table, not as one shared amount:

| dimension | finished value | basis | confidence |
|---|---|---|---|
| **Chest** (straight body) | `max(body_chest, body_hip) + base·ease_factor` | manual worked examples (`:326-327`, `:488`) | **solid** |
| **Back width** | `body_back_width + ½·(base·ease_factor)` | geometry: a flat back panel spans ~half the circumference, so ~half the chest ease. **Assumption** | flag — confirm at checkpoint |
| **Armhole** | `2·arm_depth + <ease?>` | baseline `2×` is manual (`:257`, `:506`); ease magnitude **unknown** | flag — confirm at checkpoint |
| **Upper arm** (sleeve top) | `body_upper_arm + <ease?>` | manual says ease applies here (`:325`); magnitude **unknown** | flag — confirm at checkpoint |

Only **Chest** is trustworthy today. The other three carry a stated assumption and must be
eyeballed against the Woman-36" table (and ideally one readout of the original's "Garment
Dimensions" screen, which would fix all three exactly).

Lengths (body length, sleeve length) get **no ease-style ease** — the manual is explicit
that ease is applied to the four widths, "not to lengths" (`ease_model.md`, `manual.txt:325`).
They carry their own fixed comfort allowances, derived separately (open item L1).

## Open items (must be resolved or explicitly signed off before Phase 2)

- **R1 — default rib gauge / rib pull-in.** How the original sets rib width and the default
  rib gauge when no rib swatch is entered. `manual.txt:368`, `:1367` describe it qualitatively.
- **E1 — per-dimension ease for back width / armhole / upper arm.** The three flagged rows
  above. Best resolved by one "Garment Dimensions" readout for a known size+style.
- **L1 — length allowances.** Body length and sleeve length comfort allowances.
- **N1 — neckline geometry.** Front/back neck width & depth defaults per neckline style
  (crew for the Phase-1 target). `manual.txt:429`, `:530-535` give partial defaults.
- **M1 — metric ease bases.** No metric worked examples exist; see `ease_model.md`.

## Phase-1 target (the "done" bar)

Woman 36", moderate ease, set-in sleeve, flat bottom-up, crew-neck pullover, at a stated
gauge → a complete, plausible `Row[]` for back, front and both sleeves with reconciling
stitch counts. The dimensions checkpoint (Woman 36" × five ease styles, finished chest
called out) gates everything after it.
