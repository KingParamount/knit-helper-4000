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
| Moderate | **≈1.70** | 2.33 → "2.3" | 2.84 → "2.9" | ~ off by 0.1 |
| Comfortable | **3.00** | 4.11 → "4" | 5.01 → "5" | ✓ |
| Oversized | **4.50** | 6.17 → "6" | 7.52 → "7.5" | ✓ |

8 of 10 exact. Skintight is exactly negated Tight.

## OPEN QUESTION — resolve before trusting

Two predictions are off by 0.1":

- Moderate @ Woman 46" predicts 2.84 ("2.8"), manual says "2.9"
- Moderate @ Man 52" predicts 3.40 ("3.4"), manual says "3.5"

Both errors are in the same direction and both are Moderate. Candidate explanations:

1. `base[moderate]` is 1.71–1.75 rather than 1.70, and the manual's other figures round to hide it.
   (1.75 fixes Man 52" exactly but breaks Woman 36".)
2. The app rounds the computed ease to the nearest 0.25" before applying it.
3. There's an additive term as well as a multiplicative one.
4. The manual's prose is simply rounded inconsistently by a human.

**Action:** search `manual.txt` for further worked examples and fit against all of them.
Do not hard-code 1.70 without checking. If it can't be resolved, prefer (4) and use 1.70 —
the error is 0.1" on a garment, i.e. well inside knitting tolerance.

## Where ease is applied

Per the manual: **chest, back width, armhole, upper arm.** Not to lengths.
`ease_arml` is applied to the armhole separately and additively — the relationship
between `ease_arml` and the armhole component of `ease_factor * base` is **not yet
established**. Check the manual's ARMHOLE topic.

## Metric

The size table stores every size twice, once with `units: "in"` and once with `units: "cm"`.
`ease_factor` is identical in both rows (it is dimensionless). The `base` values above are
in **inches**. For metric, either convert the result or derive metric bases from the cm rows.
Do not assume `base_cm = base_in * 2.54` without checking against the manual's metric examples —
the original may have used rounded metric constants rather than converting.
