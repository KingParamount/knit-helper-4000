# Brief — Knit-Helper 4000

Read `CLAUDE.md` first — it has the naming, the architecture rules and the provenance
constraints.

## What we're building

A knitting pattern generator. Enter a size and a gauge, choose a garment, get:

1. A **printable written pattern** — the instructions, in plain language.
2. A **schematic** of each piece — dimensions, stitch counts, shaping marked.

Later (not now, but the architecture must not preclude it): a **live row-by-row feed**
driven by a sensor on a physical knitting machine that advances the pattern as you knit.

## Who it's for

People who have never heard of Knitware and would not be able to install it if they had.
Hand knitters and machine knitters. Not developers. The whole point is that the original
is a 2005 Windows binary requiring the Borland Database Engine, and its remaining users
run Windows XP in a VM to use it. That barrier is what we're removing.

## What you have

```
data/
  sizes_canonical.csv     70 rows x 32 cols. 35 sizes x 2 unit systems (in/cm).
  sizes_canonical.json    Same, as JSON.
  options.json            The full option vocabulary — construction, shoulder,
                          sleeve, neckline, collar, hem, ease, etc.
  constraints.json        34 structural rules + engine limits. DRAFT encoding;
                          verbatim source text preserved. VERIFY against the manual.
  ease_model.md           The ease formula, derived, with one open question.

reference/                Consult on demand. Do not load wholesale into context.
  sweaters/
    manual.txt            ~255KB, ~90 topics. The full user manual.
    constraints_raw.txt   Raw extracted strings, pre-structuring.
    hints.txt             ~324 field-level tooltips. Effectively a mini-manual.
    dfms/                 50 decompiled UI form definitions.
  skirts/   (same shape)
  basics/   (same shape — dogs, cats, dolls, teddy bears)

tools/
  paradox.py, dfm.py      The extractors, if you ever need to go back to source.
  EXTRACTION.md           How the data was obtained.
```

### Notes on the data

- `sizes_canonical.csv` merges three separate (and mutually incompatible) size tables
  from the three original programs. They agreed on 208 of 210 shared measurements, so
  there is one coherent body model underneath. `category` replaces the original `Sex`
  column, which was lying — it stored `C`/`M`/`W` meaning child/man/woman.
- Gaps in the CSV are honest. `neck`/`armhole`/`crotch`/`leg_length`/`thigh` are absent
  for 10 of 70 rows because the source program that had those fields didn't cover babies.
  `age` is only meaningful for babies and children.
- `constraints.json` is a **draft interpretation**. The `text` fields are verbatim and
  authoritative; the structured encoding is mine and several rules are flagged
  `confidence: medium` with parsing ambiguities noted. Check them against `manual.txt`
  before relying on them.

## Phase plan

### Phase 1 — the engine, no UI

A workspace package. Zero I/O. Tests in Node.

- Load `sizes_canonical.json` and `options.json` as typed data.
- Implement the constraint validator from `constraints.json`. It runs **before**
  generation and returns errors + warnings. `BOAT_OVERLAP_WARNING` is a warning and
  must not block.
- Implement the ease model per `ease_model.md`. **First, resolve the open question** —
  search `manual.txt` for more worked examples and fit `base[moderate]` against all of them.
- Implement grading + shaping maths from first principles. Standard sweater grading is
  well documented in public knitting literature. Do not try to reverse the original's
  arithmetic; derive it.
- Output: `Row[]` per piece, with `carriage` populated.
- **Target for "done":** a Woman 36", moderate ease, set-in sleeve, flat bottom-up,
  crew neck pullover at a stated gauge produces a complete, plausible row array for
  back, front and both sleeves, with stitch counts that reconcile.

### Phase 2 — prose renderer

`Row[] → written pattern`. Our own sentences. Sanity-check the output against a knitter's
expectations, not against the original's phrasing.

### Phase 3 — schematic renderer

`Row[] → SVG` per piece. Dimensions and stitch counts labelled. Must print sensibly.

### Phase 4 — the web app

Vite + React + TS. Form → engine → two renderers. Storage behind the interface
(IndexedDB). Deploy to GitHub Pages.

### Later, explicitly not now

- Skirts, ponchos, dog coats (data is already in `reference/skirts/` and
  `reference/basics/` when you want them — same engine, different piece sets)
- Custom sizes
- The trip device
- Desktop builds via Tauri

## Ground rules

- **Ask before inventing knitting maths.** If the manual documents something, use it.
  If it doesn't, say so rather than guessing silently.
- **Don't touch `reference/`.** It's a record.
- Write the tests as you go. The engine is pure — there's no excuse.
- Don't add a backend. Not even a small one. Not even "just for saving".
