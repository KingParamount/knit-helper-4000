# Knit-Helper 4000

A knitting pattern generator: enter a size and a gauge, pick a garment style, and
get a printable written pattern plus a schematic of each piece. For hand knitters
and machine knitters. Static site, no backend.

Live: https://kingparamount.github.io/knit-helper-4000/

## Structure

This is an npm-workspaces monorepo.

| Package | Name | What it is |
| --- | --- | --- |
| `packages/engine` | `@knit-helper-4000/engine` | Pure pattern-generation core. Zero I/O, no DOM, no React. Node-testable with vitest. |
| `packages/app` | `@knit-helper-4000/app` | The web app. Vite + React + TypeScript. |

The engine never depends on the app (enforced by lint), so it can later be reused
in a desktop build without a rewrite.

## Develop

```sh
npm install
npm run dev        # start the app
npm test           # run engine tests
npm run lint       # lint (incl. engine-isolation rules)
npm run typecheck  # type-check both packages
npm run build      # production build → packages/app/dist
```

## Data & provenance

See [`NOTICE.md`](NOTICE.md). The sizing and constraint data in `data/` is derived
from Knitware 2.50 (Morningdew Consulting Services, 2005) and comprises facts —
body measurements and construction constraints. This project is unaffiliated with
and not endorsed by Morningdew. Our code is MIT-licensed (see [`LICENSE`](LICENSE)).

## Licence

MIT — see [`LICENSE`](LICENSE). Covers this project's code only.
