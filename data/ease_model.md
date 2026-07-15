# The ease model

## What the manual says (verbatim, `reference/sweaters/manual.txt`, topic "PATTERN: STYLE DATA")

> EASE STYLE determines the amount of ease in the garment. Ease is applied to the chest, back width, armhole and upper arm measurements. The amount of ease applied varies with Ease Style and chest size.
>
> - Example 1: for a Moderate Fit, there is 1.8" ease applied to a Child 22" chest, 2.3" ease applied to a Woman 36" chest, and 3.5" ease applied to a Man's 52" chest.
> - Example 2: for the Women's sizes 36-46" chest, there is negative 1-1.3" ease applied for Skintight Ease Style, 1-1.3" applied for Tight, 2.3-2.9" for Moderate, 4-5" for Comfortable and 6-7.5" for OverSized. Note the negative ease for Skintight; this means that the garment dimensions are actually less than the body measurements.

## Derived model

`ease_factor` is a **property of the size**, not of the style. It lives in the size table
(`sizes_canonical.csv`), running 1.00 for a newborn to 2.00 for a Man 52". It is hand-tuned
by the original author and is not a formula we could reconstruct — treat it as data.

`ease_arml` is a **separate additive armhole allowance**, also per-size, 0.50 → 2.00.

The model appears to be:

```
ease_inches = base[ease_style] * ease_factor[size]
```

### Deriving `base` from Example 1

| Size | ease_factor | manual says Moderate | implied base |
|---|---|---|---|
| Child 22" | 1.05 | 1.8" | 1.714 |
| Woman 36" | 1.37 | 2.3" | 1.679 |
| Man 52"   | 2.00 | 3.5" | 1.750 |

Constant to within the manual's 1-decimal rounding → the multiplicative form holds.

### Solving `base` for all five styles from Example 2

Women 36" (`ease_factor` 1.37) and Women 46" (`ease_factor` 1.67):

| Style | base | @1.37 → manual | @1.67 → manual | |
|---|---|---|---|---|
| Skintight | **−0.75** | −1.03 → "−1" | −1.25 → "−1.3" | ✓ |
| Tight | **0.75** | 1.03 → "1" | 1.25 → "1.3" | ✓ |
| Moderate | **1.71** | 2.34 → "2.3" | 2.86 → "2.9" | ✓ (both Ex.2 figures) |
| Comfortable | **3.00** | 4.11 → "4" | 5.01 → "5" | ✓ |
| Oversized | **4.50** | 6.17 → "6" | 7.52 → "7.5" | ✓ |

8 of 10 exact. Skintight is exactly negated Tight.

## RESOLVED — model is multiplicative, `base[moderate] = 1.71`

Searched the full manual (`manual.txt`, 3186 lines) and `hints.txt`. **The two worked
examples above are the only ones that exist** — there is no third. So the Moderate model
rests on exactly four anchors (`ease_factor` → manual-quoted ease):

| ease_factor | manual |
|---|---|
| 1.05 (Child 22") | 1.8" |
| 1.37 (Woman 36") | 2.3" |
| 1.67 (Woman 46") | 2.9" |
| 2.00 (Man 52")   | 3.5" |

All four candidate explanations were tested against all four anchors, at the 1-decimal
rounding the manual prints. Results (not guesses — computed):

1. **Single multiplicative base — DEAD.** No single `base` reproduces all four, nor even
   Example 1 alone: Man 52" requires `base ≥ 1.725`, Woman 36" requires `base < 1.7153`
   (empty intersection). `base = 1.71` is the best single value: 3/4 exact, and the *only*
   value satisfying **both** figures of the systematic women's range in Example 2
   (1.37→2.3 *and* 1.67→2.9) plus Child 22". Its sole miss is Man 52" (3.42 vs 3.5) — a
   one-off illustration in Example 1. `base = 1.70` misses two (Woman 46" and Man 52").
2. **Round internal ease to nearest 0.25" — DEAD.** 2.9" is unreachable from any 0.25"
   multiple at 1 dp (the grid steps …2.8, 3.0… , skipping 2.9), so Woman 46" can never
   be produced under this rule.
3. **Additive term `a + b·ef` — fits, but rejected on parsimony.** An additive form *does*
   reproduce all four within rounding (e.g. `a = −0.16, b = 1.82`; 22 such pairs exist on
   a 0.01 grid). It is **not** eliminated by the data. It is rejected because it fits two
   free parameters to four rounded points with **no cross-style support**: the other four
   styles (Skintight −0.75, Tight +0.75, Comfortable 3.0, Oversized 4.5) are cleanly
   multiplicative with `a = 0` (Skintight = −Tight exactly). An additive term unique to
   Moderate, to explain a 0.1" residual, is unmotivated.
4. **Loose human rounding in the prose — this is the residual.** Example 2's own prose
   drops decimals: it quotes Comfortable as "4-5" where the model gives 4.11-5.01, and
   Oversized as "6-7.5" where the model gives 6.17-7.52. The 0.1" Moderate discrepancies
   are the same loose rounding, well inside knitting tolerance.

**Decision:** `ease_inches = base[style] · ease_factor[size]`, multiplicative,
`base[moderate] = 1.71`. Candidates 1 (exact) and 2 are disproved; candidate 3 is a
rejected overfit; the ≤0.1" residual is candidate 4 (manual prose rounding).

## Where ease is applied

Per the manual (`manual.txt:325`): **chest, back width, armhole, upper arm.** Not to lengths.

**`ease_arml` is NOT an armhole allowance.** The form definition
(`dfms/TCUSTOMSIZEFORM.dfm:528`, field `EaseArml`, control `DBArmEase`) labels it
*"Ease adjustment for length of sleeve"* and marks the control `Visible = False`. It is a
hidden **sleeve-length** ease parameter (`arml` = arm length), unrelated to the armhole.
Do not add it to armhole maths.

**Only the chest ease scales with fit style.** `base·ease_factor` is worked only for the
*chest* in the manual, and for a **set-in sleeve** the other widths turn out to be fixed
allowances rather than fractions of it (a set-in armhole/sleeve is fitted regardless of body
looseness). Resolved against 2026 standards, not the manual — see `dimensions_model.md`:
back width +0", armhole depth +1.5", sleeve top +1" (Sister Mountain); chest = bust + ease,
bust-only (CYC). The armhole *around*-measure is `2 × armhole_depth` (`manual.txt:257`,
"use half of the measurement around the armhole"). The Basics `armhole` column is a *body*
girth from a different program and is **not** an answer key — ignore it.

## Metric — the cm rows are a separate dataset, not conversions (verified)

The size table stores every size twice, `units: "in"` and `units: "cm"`. **The cm rows are
independently rounded to friendly numbers, not converted from inches** — e.g. Baby 18" is
stored as **46 cm, not 45.72**; the whole cm ladder is its own clean 5-cm-step set. So the
two unit systems are two datasets, not one dataset plus a converter. `ease_factor` is
identical in both (it is dimensionless).

Consequences for the engine:
- **Internal unit: millimetres.** Convert to mm from the **chosen row's native values**
  (cm row → ×10, inch row → ×25.4), never by cross-converting one unit system into the other.
- The `base` values above are in **inches**. **Do not compute `base_cm = 1.71 × 2.54`.**
- **There are no metric worked ease examples in the manual** (searched — Examples 1 and 2 at
  `manual.txt:326-327` are both in inches). So the metric ease bases **cannot be derived** and
  are an **OPEN QUESTION**. Until resolved, compute ease from the inch model and convert the
  *result* for display; treat a metric-native ease path as unbuilt.

Display, separately: user picks cm or inches in the UI; inches render as **fractions (16ths),
never decimals** (a knitter reads "3⅜in", not "3.4in").
