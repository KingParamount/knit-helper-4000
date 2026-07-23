/* Simple line icons for the buttons. Stroke uses currentColor so they follow the
 * button's text colour (dark normally, white when selected). Fill-none throughout.
 *
 * Several axes are FAMILIES — one component parameterised by the option, so every
 * value in a tile gets a distinct, meaningful glyph rather than a repeated one:
 * IconNeck (neckline shape), IconShoulderStyle (armhole/seam), IconSleeveLen (how
 * far the sleeve reaches), IconSleeveShape (its profile), IconLength (where the hem
 * falls). */
import type { JSX } from 'react';

const svg = (children: JSX.Element): JSX.Element => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconSweater = (): JSX.Element =>
  svg(<><path d="M12 6 L20 6 L24 9 L27 22 L23 23 L21 12 L21 27 L11 27 L11 12 L9 23 L5 22 L8 9 Z" /></>);

export const IconCardigan = (): JSX.Element =>
  svg(<><path d="M12 6 L20 6 L24 9 L27 22 L23 23 L21 12 L21 27 L11 27 L11 12 L9 23 L5 22 L8 9 Z" /><path d="M16 6 V27" /></>);

export const IconSkirt = (): JSX.Element =>
  svg(<><path d="M11 7h10l4 19H7z" /><path d="M11 7c0 3 10 3 10 0" /></>);

export const IconDog = (): JSX.Element =>
  svg(<><path d="M6 14c0-3 3-4 5-4h9l3 3v3h-2v8h-4v-6H11v6H7v-8c-1 0-1-2-1-2z" /><path d="M20 10V6l3 2" /></>);

export const IconBaby = (): JSX.Element =>
  svg(<><circle cx="16" cy="10" r="4" /><path d="M10 27v-4a6 6 0 0 1 12 0v4" /></>);
export const IconChild = (): JSX.Element =>
  svg(<><circle cx="16" cy="9" r="4" /><path d="M9 27v-6a7 7 0 0 1 14 0v6" /></>);
export const IconWoman = (): JSX.Element =>
  svg(<><circle cx="16" cy="8" r="4" /><path d="M11 13h10l-2 6 2 8h-10l2-8z" /></>);
export const IconMan = (): JSX.Element =>
  svg(<><circle cx="16" cy="8" r="4" /><path d="M8 26v-9a8 8 0 0 1 16 0v9" /></>);
export const IconCustom = (): JSX.Element =>
  svg(<><path d="M5 20 20 5l7 7L12 27H5z" /><path d="M15 10l7 7" /></>);

// The garment widens around a fixed body as the ease grows (level 0–4).
export const IconEase = ({ level }: { level: number }): JSX.Element => {
  const w = 4 + level * 2.4;
  return svg(
    <>
      <rect x={16 - w} y={6} width={2 * w} height={20} rx={3} />
      <rect x={13} y={9} width={6} height={15} rx={2} strokeDasharray="2 2" />
    </>,
  );
};

// ---- technique -------------------------------------------------------------

// A knitting machine: the carriage riding the needle bed.
export const IconMachine = (): JSX.Element =>
  svg(<><rect x="6" y="10" width="20" height="7" rx="1.5" /><path d="M4 21h24" /><path d="M8 21v3M12 21v3M16 21v3M20 21v3M24 21v3" strokeWidth={1.4} /></>);
// Hand knitting: two crossed needles and a ball of yarn.
export const IconHand = (): JSX.Element =>
  svg(<><path d="M7 25 24 7" /><path d="M12 26 27 10" /><circle cx="9" cy="22" r="2.4" /></>);

// ---- necklines -------------------------------------------------------------
// A garment torso whose top edge IS the neckline; each value cuts a different shape.

const NECK: Record<string, { x1: number; d: string; extra?: JSX.Element }> = {
  round: { x1: 11, d: 'Q16 15 21 9' },
  v: { x1: 11, d: 'L16 17 L21 9' },
  scoop: { x1: 10, d: 'Q16 21 22 9' },
  high_round: { x1: 13, d: 'Q16 12.5 19 9' },
  shallow: { x1: 10, d: 'Q16 12.5 22 9' },
  square: { x1: 11, d: 'L11 16 L21 16 L21 9' },
  boat: { x1: 7, d: 'Q16 11.5 25 9' },
  ballet: { x1: 9, d: 'Q16 14 23 9' },
  keyhole: { x1: 11, d: 'Q16 13 21 9', extra: <><path d="M16 13V18" /><circle cx="16" cy="19.6" r="1.6" /></> },
  flat: { x1: 10, d: 'L22 9' },
  backless: { x1: 9, d: 'Q16 25 23 9' },
};

export const IconNeck = ({ shape = 'round' }: { shape?: string }): JSX.Element => {
  const s = NECK[shape] ?? NECK.round;
  return svg(<><path d={`M6 27 L6 9 L${s.x1} 9 ${s.d} L26 9 L26 27 Z`} />{s.extra}</>);
};

// ---- shoulders -------------------------------------------------------------
// A torso silhouette, with the armhole / shoulder SEAM drawn per style.

const TORSO = 'M6 27 L6 11 L10 8 L13 8 Q16 11 19 8 L22 8 L26 11 L26 27 Z';

const SHOULDER: Record<string, JSX.Element> = {
  // Curved, fitted scye.
  set_in: <><path d="M10 9 Q13 15 12 21" /><path d="M22 9 Q19 15 20 21" /></>,
  // Square dropped armhole — a straight seam down from an extended shoulder.
  drop: <><path d="M11 8.5V21" /><path d="M21 8.5V21" /></>,
  // Diagonal seam from neck to underarm.
  raglan: <><path d="M13 8.5 L9 21" /><path d="M19 8.5 L23 21" /></>,
  // A strap band riding over each shoulder, plus the scye.
  saddle: <><path d="M10 9 Q13 15 12 21" /><path d="M22 9 Q19 15 20 21" /><path d="M13 8 L10 8.5 L10 10.5 L13 10" /><path d="M19 8 L22 8.5 L22 10.5 L19 10" /></>,
  // A gentler curve than set-in.
  modified_drop: <><path d="M11 8.5 Q12.5 15 11.5 21" /><path d="M21 8.5 Q19.5 15 20.5 21" /></>,
  // Drop, joined by a grafted (dashed) seam.
  drop_grafted: <><path d="M11 8.5V21" strokeDasharray="2.4 2.4" /><path d="M21 8.5V21" strokeDasharray="2.4 2.4" /></>,
  // A round yoke — a seam encircling below the neck.
  round_yoke: <><path d="M8 13 Q16 18.5 24 13" /></>,
};

export const IconShoulderStyle = ({ style = 'set_in' }: { style?: string }): JSX.Element =>
  svg(<><path d={TORSO} />{SHOULDER[style] ?? SHOULDER.set_in}</>);

// ---- sleeve length ---------------------------------------------------------
// A sleeve hanging from the shoulder, reaching a different depth; sleeveless is
// an open armhole with a band instead of a sleeve.

const SLEEVE_BOTTOM: Record<string, number> = {
  full: 27,
  three_quarter: 22,
  half: 17,
  short: 12.5,
  cap: 10,
};

export const IconSleeveLen = ({ len = 'full' }: { len?: string }): JSX.Element => {
  if (len === 'sleeveless') {
    return svg(<><path d="M9 7 Q12 5 15 7" /><path d="M15 8 Q10 13 12 20" /><path d="M13.4 8.8 Q9 13 11 19" /></>);
  }
  const b = SLEEVE_BOTTOM[len] ?? SLEEVE_BOTTOM.full;
  return svg(<><path d="M9 7 Q12 5 15 7" /><path d={`M9 7 L${10.5} ${b} L${13.5} ${b} L15 7`} /><path d={`M10.5 ${b} L13.5 ${b}`} /></>);
};

// ---- sleeve style ----------------------------------------------------------
// A full-length sleeve whose PROFILE differs (straight, bulged, flared, gathered…).

const SLEEVE_SHAPE: Record<string, string> = {
  moderate_taper: 'M9 6 L15 6 L13 26 L11 26 Z',
  narrow_taper: 'M10 6 L14 6 L12.5 26 L11.5 26 Z',
  lantern: 'M10 6 L14 6 Q18 16 13 26 L11 26 Q6 16 10 6 Z',
  modified_lantern: 'M10 6 L14 6 Q16.5 15 13 26 L11 26 Q7.5 15 10 6 Z',
  bishop: 'M10 6 L14 6 L13.5 19 Q18 27 12 27 Q6 27 10.5 19 Z',
  bell: 'M11 6 L13 6 L16 26 L8 26 Z',
  dolman: 'M6 6 L16 6 L13 26 L11 26 Q11 13 6 6 Z',
};

export const IconSleeveShape = ({ style = 'moderate_taper' }: { style?: string }): JSX.Element =>
  svg(<><path d={SLEEVE_SHAPE[style] ?? SLEEVE_SHAPE.moderate_taper} /></>);

// ---- body length -----------------------------------------------------------
// A garment whose hem falls at a depth set by `level` (0 = crop … 8 = ankle).

export const IconLength = ({ level }: { level: number }): JSX.Element => {
  const hem = 10.5 + level * 2.15;
  return svg(<><path d="M13 6 Q16 8.5 19 6" /><path d={`M11 6 L10 ${hem} L22 ${hem} L21 6`} /></>);
};

// ---- output & print --------------------------------------------------------

export const IconDocFull = (): JSX.Element =>
  svg(<><rect x="8" y="4" width="16" height="24" rx="2" /><path d="M11 10h10M11 14h10M11 18h10M11 22h6" /></>);
export const IconDocShort = (): JSX.Element =>
  svg(<><rect x="8" y="4" width="16" height="24" rx="2" /><path d="M11 11h10M11 16h7M11 21h9" /></>);
export const IconChart = (): JSX.Element =>
  svg(<><rect x="6" y="6" width="20" height="20" rx="1" /><path d="M11 6v20M16 6v20M21 6v20M6 11h20M6 16h20M6 21h20" strokeWidth={1} /></>);
export const IconRoller = (): JSX.Element =>
  svg(<><rect x="6" y="7" width="20" height="6" rx="3" /><path d="M16 13v5" /><rect x="11" y="18" width="10" height="8" rx="1" /></>);

export const IconPrint = (): JSX.Element =>
  svg(<><path d="M9 12V5h14v7" /><rect x="6" y="12" width="20" height="9" rx="2" /><path d="M9 21v6h14v-6" /></>);
