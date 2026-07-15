# Project context

**Knit-Helper 4000.**

A knitting pattern generator: you enter a size and a gauge, pick a garment style,
and it produces a printable written pattern plus a schematic of each piece.

Aimed at hand knitters and machine knitters. Deployed as a static site on GitHub Pages.

## Naming

- Product name: **Knit-Helper 4000**
- Repo / package / directory slug: `knit-helper-4000`
- Vite `base` must be `/knit-helper-4000/` for a GitHub Pages project page
- Workspace packages: `@knit-helper-4000/engine`, `@knit-helper-4000/app`

The `4000` is deliberate and is not to be quietly dropped for being unserious.

## Provenance of the data in `data/` and `reference/`

This data was reverse-engineered from **Knitware** (Morningdew Consulting Services,
2005), a discontinued Windows/Delphi/Paradox application. Three programs — Sweaters,
Skirts & Shawls, and Basics — were extracted; their sizing tables, option vocabulary,
constraint rules and user manuals are in `data/` and `reference/`.

**This project is not a Knitware clone and must not be called Knitware.** The name is
likely still a live trademark. Do not use it in code, comments, UI, package names,
or documentation beyond the historical references in `reference/`.

### What we may use freely

- **Body measurements** (`data/sizes_canonical.csv`). Facts. A 38" bust has those
  proportions regardless of who wrote them down.
- **The `ease_factor` / `ease_arml` curves.** Numeric data.
- **The constraint rules** (`data/constraints.json`). Geometric and physical facts
  about how knitted garments go together. "Saddle shoulder cannot have a boat neckline"
  is not an opinion.
- **The option vocabulary** (`data/options.json`). Names of garment features that are
  standard knitting terminology, not coinages.

### What we must NOT use

- **The pattern prose.** The generated instruction sentences ("Dec 1 st at each end of
  next and every following...") are the one genuinely authored thing in the original.
  `reference/*/prose_fragments.txt` exists **for orientation only**. Do not copy those
  sentences, do not paraphrase them closely, do not use them as templates. Write our
  own prose from the row data.
- **The manuals verbatim.** `reference/*/manual.txt` is reference material to consult.
  Do not lift its wording into our docs or UI.

## Non-goals

- Not importing users' saved Knitware `.DB` files. Decided against. The single-char
  storage codes (`Shoulder='R'`) were deliberately not recovered. Do not reintroduce them.
- Not matching Knitware's UI. Its UI was clunky; that's the reason this exists.
- Not matching Knitware's option set exactly. It's a starting point, not a spec.
  We're free to add what it couldn't (top-down set-in, short-row bust darts, etc).
- **No backend.** No server, no accounts, no database, no API. Static site only.
  Everything client-side. This is not a temporary constraint — it's the design.

## Architecture rules

These four exist so the app can later be wrapped as a desktop binary (Tauri) without
a rewrite. They cost nothing now.

1. **The engine is a separate package with zero I/O.** No React import, no `window`,
   no `fetch`, no filesystem. Pure functions: data in, data out. It must be testable
   in Node with no DOM.
2. **Storage behind an interface.** `save(pattern)` / `load(id)` / `list()` / `delete(id)`.
   IndexedDB implementation now, filesystem later. Never call storage APIs directly
   from components.
3. **One canonical internal unit.** Pick millimetres or inches, store everything in it,
   convert only at the render boundary. The source data ships every size twice (in/cm);
   do not carry that duality inward.
4. **The core representation is a row array, not prose.** See below.

## The row array

Prose, schematic and (eventually) a live row-by-row feed from a hardware sensor are all
**renderers over one structure**. Generate the structure, then render it three ways.

```ts
type Row = {
  index: number;            // 1-based, per piece
  piece: 'back' | 'front' | 'sleeve_l' | 'sleeve_r' | 'collar' | ...;
  stitches: number;         // count AFTER this row's ops
  carriage: 'L' | 'R';      // side the carriage ends on (machine knitting)
  ops: Op[];                // shaping events on this row
  section?: string;         // 'rib' | 'body' | 'armhole' | 'neck' | ...
};
```

`carriage` matters and must be there from the start. On a knitting machine you physically
cannot perform some operations unless the carriage is on the correct side. A generator
that ignores this produces unknittable patterns. Direction alternates deterministically
from a known start, so it's cheap to track — but retrofitting it is not.

## Stack

- Vite + React + TypeScript
- Deployed to GitHub Pages as a project page → Vite `base: '/knit-helper-4000/'`
- No CSS framework mandated; keep it light
- Engine as a workspace package with its own tests

## Conventions

- UK English in user-facing copy ("colour", "grey"). The source data uses US spellings
  in places; normalise ours.
- snake_case in data files, camelCase in TS.
- Every constraint rule in `constraints.json` keeps its verbatim `text` field. If you
  change the structured encoding, don't touch `text` — it's the provenance record.
