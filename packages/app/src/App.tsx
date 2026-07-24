import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { availableChests, schematicMetrics, flatBackAllowed, highRoundFrontAllowed, highRoundBackAllowed, boatAllowed, bodyLengthAllowed, hemAllowed, sleeveStyleAllowed, sleeveShapeAllowed, collarAllowed, collarForcesFlatNeck } from '@knit-helper-4000/engine';
import type { Category, Units, NeckStyle, BackNeckStyle, ShoulderStyle, BodyLength, HemStyle, SleeveLength, SleeveStyle, CollarStyle } from '@knit-helper-4000/engine';
import {
  DEFAULT_SWATCH,
  buildPattern,
  buildPatternText,
  buildSchematics,
  gaugeFromSwatch,
  gaugeReadout,
  resolveSize,
  svgFor,
  type EaseId,
  type PieceId,
  type Swatch,
} from './engine';
import {
  IconSweater, IconCardigan, IconSkirt, IconDog,
  IconBaby, IconChild, IconWoman, IconMan, IconCustom,
  IconEase, IconNeck, IconShoulderStyle, IconSleeveLen, IconSleeveShape,
  IconMachine, IconHand, IconLength,
  IconDocFull, IconDocShort, IconChart, IconRoller, IconPrint,
} from './icons';
import { PrintDoc } from './PrintDoc';
import {
  PAPERS, planTiles, planBands, describePlan, fitScaleFactor, mmToPx, pxToMm,
  PATTERN_MARGIN_MM, DIAGRAM_HEAD_MM, type PaperId,
} from './tiling';
import './theme.css';

type OutputId = 'full' | 'concise' | 'chart' | 'knitleader' | 'knitradar';
/** How the garment is made. Machine and hand are both built; crochet is out of scope. */
type Method = 'machine' | 'hand';

// ---- small building blocks --------------------------------------------------

function Section({ label, num, children }: { label?: string; num?: number; children: ReactNode }): JSX.Element {
  return (
    <section className="section">
      {label && (
        <h2 className="section-head">
          {num != null && <span className="section-num">{num}:</span>} {label}
        </h2>
      )}
      <div className="tiles">{children}</div>
    </section>
  );
}

function Tile({ title, className = '', children }: { title?: string; className?: string; children: ReactNode }): JSX.Element {
  return (
    <div className={`tile ${className}`}>
      {title && <div className="tile-title">{title}</div>}
      {children}
    </div>
  );
}

type BtnState = 'normal' | 'selected' | 'soon' | 'blocked';
function Btn({
  icon, label, state = 'normal', onClick,
}: { icon?: JSX.Element; label: string; state?: BtnState; onClick?: () => void }): JSX.Element {
  const cls = state === 'selected' ? 'selected' : state === 'soon' ? 'soon' : state === 'blocked' ? 'blocked' : '';
  const disabled = state === 'soon' || state === 'blocked';
  return (
    <button className={`btn ${cls}`} onClick={disabled ? undefined : onClick} aria-pressed={state === 'selected'} disabled={disabled}>
      {icon && <span className="ico">{icon}</span>}
      <span className="lbl">{label}</span>
      {state === 'soon' && <span className="badge">soon</span>}
    </button>
  );
}

/**
 * A diagram sized to its container instead of drawn large and shrunk by CSS.
 *
 * Same reasoning as the printed page: `scaleFactor` scales the drawing but not the
 * label text, so re-rendering at a smaller scale keeps the labels full size, whereas
 * letting CSS shrink the SVG shrinks the labels with it — which is why they were only
 * just legible here and unreadable on paper. It also makes the calibration line honest:
 * the drawing used to be emitted at 1:1, labelled "10 cm at full scale", and then
 * squeezed to about half by max-width, so the line never measured what it claimed.
 */
function FittedDiagram({
  metrics, svgAt, className = 'diagram',
}: {
  metrics: { W: number; H: number; pad: number; padX: number; topExtra: number } | null;
  svgAt: (factor: number) => string;
  className?: string;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setBox({ w: e.contentRect.width, h: window.innerHeight * 0.7 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // First paint has no measurement yet; draw nothing rather than flash a huge diagram.
  const html = metrics && box.w > 0 ? svgAt(fitScaleFactor(metrics, box.w, box.h)) : '';
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// ---- swatch measurement field ----------------------------------------------

function Measure({ inches, onChange, units }: { inches: number; onChange: (inches: number) => void; units: Units }): JSX.Element {
  if (units === 'cm') {
    // A plain decimal box, no steppers.
    const cm = inches * 2.54;
    return (
      <span className="numfield">
        <input
          type="number" min={0} step={0.1} value={Number(cm.toFixed(1))}
          onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0) / 2.54)}
        />
        <span className="unit">cm</span>
      </span>
    );
  }
  // Inches: a typed whole-inches box, and a separate eighths stepper (arrows, no typing).
  const whole = Math.floor(inches + 1e-9);
  const eighths = Math.round((inches - whole) * 8);
  const setTotalEighths = (t: number): void => onChange(Math.max(0, t) / 8);
  return (
    <span className="numfield inch">
      <input
        type="number" className="whole" min={0} step={1} value={whole}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0) + eighths / 8)}
      />
      <span className="eighths">
        <span className="frac">{eighths}<span className="over">⁄8</span></span>
        <span className="stepper">
          <button onClick={() => setTotalEighths(whole * 8 + eighths + 1)} aria-label="up an eighth">▲</button>
          <button onClick={() => setTotalEighths(whole * 8 + eighths - 1)} aria-label="down an eighth">▼</button>
        </span>
      </span>
      <span className="unit">in</span>
    </span>
  );
}

/**
 * A plain whole-number field, for the stitch and row COUNTS a swatch is measured
 * over. Distances get the eighths stepper (Measure); counts are just typed.
 */
function Count({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }): JSX.Element {
  return (
    <span className="numfield count">
      <input
        type="number" min={min} step={1} value={value}
        onChange={(e) => onChange(Math.max(min, parseInt(e.target.value) || min))}
      />
    </span>
  );
}

// ---- app --------------------------------------------------------------------

const EASES: { id: EaseId; label: string }[] = [
  { id: 'skintight', label: 'Skintight' },
  { id: 'tight', label: 'Tight' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'oversized', label: 'Oversized' },
];
const BODY_LENGTHS: { id: BodyLength; label: string }[] = [
  { id: 'crop', label: 'Crop' },
  { id: 'waist', label: 'Waist' },
  { id: 'regular', label: 'Regular' },
  { id: 'hip', label: 'Hip' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'above_knee', label: 'Above knee' },
  { id: 'knee', label: 'Knee' },
  { id: 'calf', label: 'Calf' },
  { id: 'ankle', label: 'Ankle' },
];
const HEMS: { id: HemStyle; label: string }[] = [
  { id: 'ribbing', label: 'Ribbing' },
  { id: 'moss_band', label: 'Moss band' },
  { id: 'garter_band', label: 'Garter band' },
  { id: 'folded_band', label: 'Folded band' },
  { id: 'frill', label: 'Frill' },
  { id: 'none', label: 'No hem' },
];
const SLEEVE_LENGTHS: { id: SleeveLength; label: string }[] = [
  { id: 'full', label: 'Full' },
  { id: 'three_quarter', label: '¾ length' },
  { id: 'half', label: 'Half' },
  { id: 'short', label: 'Short' },
  { id: 'cap', label: 'Cap' },
  { id: 'sleeveless', label: 'Sleeveless' },
];

export function App(): JSX.Element {
  const [units, setUnits] = useState<Units>('in');
  const [category, setCategory] = useState<Category>('Woman');
  const [chest, setChest] = useState(36);
  const [ease, setEase] = useState<EaseId>('moderate');
  const [neck, setNeck] = useState<NeckStyle>('round');
  const [backNeck, setBackNeck] = useState<BackNeckStyle>('scoop');
  const [shoulder, setShoulder] = useState<ShoulderStyle>('set_in');
  const [collarStyle, setCollarStyle] = useState<CollarStyle>('single_band');
  const [bodyLength, setBodyLength] = useState<BodyLength>('hip');
  const [hem, setHem] = useState<HemStyle>('ribbing');
  const [sleeveLength, setSleeveLength] = useState<SleeveLength>('full');
  const [sleeveStyle, setSleeveStyle] = useState<SleeveStyle>('moderate_taper');
  const [swatch, setSwatch] = useState<Swatch>(DEFAULT_SWATCH);
  const [output, setOutput] = useState<OutputId>('full');
  const [piece, setPiece] = useState<PieceId>('back');
  const [help, setHelp] = useState(false);
  const [method, setMethod] = useState<Method>('machine');
  const [paper, setPaper] = useState<PaperId>('a4');
  const [landscape, setLandscape] = useState(false);
  const paperRec = PAPERS.find((p) => p.id === paper) ?? PAPERS[0];

  const chests = useMemo(() => availableChests(category, 'in'), [category]);
  const chooseCategory = (c: Category): void => {
    setCategory(c);
    const list = availableChests(c, 'in');
    if (!list.includes(chest)) setChest(list[Math.floor(list.length / 2)]);
  };
  const chestCm = Math.round(chest * 2.54);
  // Babies are sized by weight (Knitware's axis for the category); everyone else by
  // chest. The slider always steps through chest inches internally — for a baby it is
  // only the label that reads as a weight. Weight converts at the boundary like any
  // other unit (lb with inches, kg with cm), same as chest inches → cm.
  const sizeRec = resolveSize(category, chest);
  const isBaby = category === 'Baby';
  const weightLb = sizeRec?.weight;
  const weightKg = weightLb != null ? Math.round(weightLb * 0.453592 * 10) / 10 : undefined;
  const sizeVal = isBaby
    ? (units === 'cm' ? weightKg : weightLb) ?? ''
    : units === 'cm'
      ? chestCm
      : chest;
  const sizeUnit = isBaby ? (units === 'cm' ? 'kg' : 'lb') : units === 'cm' ? 'cm chest' : 'in chest';

  // A flat BACK neck loses the scoop depth that opens a crew over the head, so it is only
  // offered where the head still clears (agreed policy: block, don't warn); if a flat back
  // is selected but can't be worn at this size it falls back to a scoop so the pattern is
  // always wearable. (The flat FRONT is built in the engine but parked out of the UI — it
  // is a narrow slash neck that clears only the widest sizes; see the coverage-map memory.)
  const flatBackOk = sizeRec ? flatBackAllowed(sizeRec, neck) : true;
  // A high round (front or back) sits shallow, so on small sizes it can fail to clear the
  // head — same block-not-warn policy as the flat back. The head-solving scoop back rescues
  // a shallow front, so a blocked selection falls back (front → crew, back → scoop).
  const highRoundBackOk = sizeRec ? highRoundBackAllowed(sizeRec, neck) : true;
  // A boat is a whole-neck mode: it forces the back to match (front = back) and needs a
  // set-in or drop shoulder (saddle/raglan have no straight top to band) and a real sleeve
  // (its top is not an inset armhole band). Those are forced here, block-not-warn.
  const boat = neck === 'boat';
  // Collar: a boat allows a single band only; a turtleneck needs a compatible neck (round/flat
  // front + flat back) or it falls back to a single band. Funnel and cowl COERCE a flat front +
  // flat back (the tall collar clears the head, so the parked flat front is fine under it).
  const collarOk = (c: CollarStyle): boolean => collarAllowed(c, neck, backNeck);
  const effCollar: CollarStyle = boat ? 'single_band' : collarOk(collarStyle) ? collarStyle : 'single_band';
  const flatFromCollar = collarForcesFlatNeck(effCollar);
  const effBackNeck: BackNeckStyle = boat
    ? 'boat'
    : flatFromCollar
      ? 'flat'
      : backNeck === 'flat' && !flatBackOk
        ? 'scoop'
        : backNeck === 'high_round' && !highRoundBackOk
          ? 'scoop'
          : backNeck;
  const effShoulder: ShoulderStyle = boat && !boatAllowed(shoulder) ? 'set_in' : shoulder;
  const highRoundFrontOk = sizeRec ? highRoundFrontAllowed(sizeRec, effBackNeck) : true;
  const effNeck: NeckStyle = flatFromCollar ? 'flat' : neck === 'high_round' && !highRoundFrontOk ? 'round' : neck;
  // Choosing a specific back neck leaves boat mode (boat locks front = back), so it also
  // resets the front to a crew. Selecting a plain back on a boat otherwise does nothing.
  const pickBack = (bn: BackNeckStyle): void => {
    if (boat) setNeck('round');
    setBackNeck(bn);
  };

  // Method maps straight onto the engine's Technique (machine | hand).
  const technique = method === 'hand' ? ('hand' as const) : ('machine' as const);

  // A frill hem is hand-only (the doubled cast-on outruns a machine bed); blocked,
  // not warned, and the selection falls back to ribbing so the pattern stays buildable.
  const hemOk = (h: HemStyle): boolean => hemAllowed(h, technique);
  const effHem: HemStyle = hemOk(hem) ? hem : 'ribbing';

  // A short body must still clear its own armhole + hem (a crop over a deep raglan can
  // ask for a body shorter than its top and bottom). Same block-not-warn policy as the
  // flat back; a blocked selection falls back to hip so the pattern stays buildable.
  // The hem feeds in: a shallow band or no hem frees rows and can unblock crop.
  const lengthOk = (bl: BodyLength): boolean =>
    sizeRec ? bodyLengthAllowed(sizeRec, ease, gaugeFromSwatch(swatch), effShoulder, bl, effHem) : true;
  const effBodyLength: BodyLength = lengthOk(bodyLength) ? bodyLength : 'hip';

  // A cap needs a set-in shoulder (it is the cap bell shortened); a boat needs a real
  // sleeve (its straight top is not an inset armhole band, so sleeveless is out). A blocked
  // pick falls back to a full sleeve so the pattern stays buildable. Block-not-warn.
  const sleeveOk = (sl: SleeveLength): boolean =>
    sleeveStyleAllowed(effShoulder, sl) && !(boat && sl === 'sleeveless');
  const effSleeveLength: SleeveLength = sleeveOk(sleeveLength) ? sleeveLength : 'full';

  // A sleeve SHAPE needs room below the cap: a bell/bishop only reads at full or ¾ length,
  // and a cap/sleeveless has no taper to shape. Blocked-not-warned; falls back to the taper.
  const shapeOk = (sh: SleeveStyle): boolean => sleeveShapeAllowed(sh, effSleeveLength);
  const effSleeveStyle: SleeveStyle = shapeOk(sleeveStyle) ? sleeveStyle : 'moderate_taper';

  const input = {
    category, chest, units, ease, neck: effNeck, backNeck: effBackNeck, shoulder: effShoulder,
    bodyLength: effBodyLength, hem: effHem, sleeveLength: effSleeveLength, sleeveStyle: effSleeveStyle, collarStyle: effCollar, swatch, technique,
  };
  const gauge = gaugeReadout(gaugeFromSwatch(swatch), units);

  // Live outputs — the engine is pure and fast, so this runs every render.
  const patternText = useMemo(
    () => buildPatternText(input, output === 'concise' ? 'abbreviated' : 'verbose'),
    [category, chest, ease, effNeck, effBackNeck, effShoulder, effBodyLength, effHem, effSleeveLength, effSleeveStyle, effCollar, swatch, output, technique],
  );
  const schematics = useMemo(
    () => buildSchematics(input),
    [category, chest, ease, effNeck, effBackNeck, effShoulder, effBodyLength, effHem, effSleeveLength, effSleeveStyle, effCollar, swatch, technique],
  );

  const diagramSvg = (pid: PieceId, factor?: number): string =>
    schematics ? svgFor(schematics[pid], { scale: 'measured', units, grid: !factor, scaleFactor: factor }) : '';

  /**
   * One density for both screen and paper. A drawing is emitted at the scale it will
   * actually be shown at, so nothing downstream has to squeeze it — see FittedDiagram
   * for why squeezing is what made the labels illegible.
   */
  const PX_PER_IN = 96;
  /** Metrics at 1:1, the input FittedDiagram fits against. */
  const screenMetrics = (pid: PieceId) =>
    schematics
      ? schematicMetrics(schematics[pid], { scale: 'measured', scaleFactor: 1, pxPerUnit: PX_PER_IN })
      : null;
  /** Keeps the grid, unlike diagramSvg — a factor here means "fitted", not "template". */
  const screenDiagramSvg = (pid: PieceId, factor: number): string =>
    schematics
      ? svgFor(schematics[pid], {
          scale: 'measured', units, grid: true, scaleFactor: factor, pxPerUnit: PX_PER_IN,
        })
      : '';

  /*
   * On paper a CSS pixel IS 1/96 inch, so a measured drawing only comes out at true
   * physical size at PX_PER_IN. The renderer's own default (46) would print every
   * drawing at just under half size — including the roller templates, where exact
   * size is the whole point, and their own "10 cm" calibration line, which is drawn
   * in the same scaled space and so shrinks with it, hiding the error.
   */
  const printDiagramSvg = (pid: PieceId, factor?: number): string =>
    schematics
      ? svgFor(schematics[pid], {
          scale: 'measured',
          units,
          grid: !factor,
          scaleFactor: factor,
          pxPerUnit: PX_PER_IN,
        })
      : '';

  /**
   * A full-page blocking diagram, rendered AT the scale it will print rather than
   * rendered full size and shrunk by CSS. The distinction is the labels: scaleFactor
   * scales the drawing but not the label text, so re-rendering keeps the text at full
   * size, where CSS scaling took it down to about 2.8pt — legible on screen, not on
   * paper.
   */
  const printBlockingSvg = (pid: PieceId): string => {
    if (!schematics) return '';
    const full = schematicMetrics(schematics[pid], {
      scale: 'measured',
      scaleFactor: 1,
      pxPerUnit: PX_PER_IN,
    });
    const pageW = landscape ? paperRec.heightMm : paperRec.widthMm;
    const pageH = landscape ? paperRec.widthMm : paperRec.heightMm;
    const f = fitScaleFactor(
      full,
      mmToPx(pageW - 2 * PATTERN_MARGIN_MM),
      mmToPx(pageH - 2 * PATTERN_MARGIN_MM - DIAGRAM_HEAD_MM),
    );
    return svgFor(schematics[pid], {
      scale: 'measured',
      units,
      grid: true,
      scaleFactor: f,
      pxPerUnit: PX_PER_IN,
    });
  };
  const chartSvg = (pid: PieceId): string =>
    schematics
      ? svgFor(schematics[pid], {
          scale: 'stitch',
          chart: true,
          grid: true,
          // A hand knitter has no centre-zero landmark on their needle, and needs to
          // know which way each row runs; a machine knitter sets needles by the bed
          // coordinate and is told the carriage side in the prose.
          axes: technique === 'hand' ? 'hand' : 'bed',
        })
      : '';

  const scaleFactor = output === 'knitleader' ? 0.5 : output === 'knitradar' ? 0.25 : undefined;
  const templateOnly = output === 'knitleader' || output === 'knitradar';

  // The piece tabs follow the garment: a boat is one piece (front == back) with an integral
  // band, so it drops the separate Front and Neckband tabs; a sleeveless garment shows
  // armhole bands rather than sleeves. Clamp the open tab so it always points at a real one.
  const isBoat = effNeck === 'boat';
  // No band tab for a boat (integral band) or 'no collar'.
  const noBand = isBoat || effCollar === 'none';
  const pieceTabs: { id: PieceId; label: string }[] = [
    { id: 'back', label: isBoat ? 'Back & front' : 'Back' },
    ...(isBoat ? [] : [{ id: 'front' as PieceId, label: 'Front' }]),
    { id: 'sleeve', label: effSleeveLength === 'sleeveless' ? 'Armhole bands' : 'Sleeves' },
    ...(noBand ? [] : [{ id: 'neckband' as PieceId, label: 'Collar' }]),
  ];
  const shownPiece: PieceId = pieceTabs.some((t) => t.id === piece) ? piece : 'back';

  // The printed sheet is its own document over the same engine output, so it carries
  // every piece regardless of which tab is open on screen. Concise stays concise.
  const printPattern = useMemo(
    () => buildPattern(input, output === 'concise' ? 'abbreviated' : 'verbose'),
    [category, chest, ease, effNeck, effBackNeck, effShoulder, effBodyLength, effHem, effSleeveLength, effSleeveStyle, effCollar, swatch, technique, output],
  );
  // How each template gets cut across sheets. Measured from the drawing's true size,
  // which the engine computes without building the SVG (schematicMetrics).
  const tilePlanFor = (pid: PieceId) => {
    const m = schematics
      ? schematicMetrics(schematics[pid], {
          scale: 'measured',
          scaleFactor,
          pxPerUnit: PX_PER_IN,
        })
      : { W: 0, H: 0 };
    return planTiles(m.W, m.H, paperRec, landscape);
  };
  // The Back is the widest piece, so its plan is the one worth previewing.
  const backPlanTiles = schematics ? tilePlanFor('back') : null;

  // Room left on a sheet once the heading has had its share — the charts are scaled
  // into this, which is what keeps each one on the same page as its title.
  const sheetRoomMm =
    (landscape ? paperRec.widthMm : paperRec.heightMm) - 2 * PATTERN_MARGIN_MM - DIAGRAM_HEAD_MM;
  /** The whole printable height — chart sheets are set to this and flex internally. */
  const pageHeightMm =
    (landscape ? paperRec.widthMm : paperRec.heightMm) - 2 * PATTERN_MARGIN_MM;

  /**
   * Landscape charts fit the page WIDTH and band down it; portrait squeezes the whole
   * chart onto one sheet. Landscape therefore trades sheets for bigger cells, which is
   * the choice worth having — a men's chart on one portrait page is legible but tight.
   */
  const chartBandsFor = (pid: PieceId) => {
    const m = schematics
      ? schematicMetrics(schematics[pid], { scale: 'stitch', chart: true, grid: true })
      : { W: 0, H: 0 };
    const pageW = (landscape ? paperRec.heightMm : paperRec.widthMm) - 2 * PATTERN_MARGIN_MM;
    // Band sheets carry their own two-line heading (piece, sheet number, size) and
    // NOT the document header, so sheetRoomMm — which already reserves a heading's
    // height — is the right budget here.
    return planBands(pxToMm(m.W), pxToMm(m.H), pageW, landscape ? sheetRoomMm : Infinity);
  };

  // Possessive per size category, for the printed title ("Ladies' Sweater").
  // Ladies' / Men's are plural possessives; Child's / Baby's are singular — the
  // register real knitting patterns use ("Child's Cardigan", "Baby's Jacket").
  const CATEGORY_POSSESSIVE: Record<Category, string> = {
    Woman: "Ladies'", Man: "Men's", Child: "Child's", Baby: "Baby's",
  };
  const titleSize = isBaby
    ? `${sizeVal} ${units === 'cm' ? 'kg' : 'lb'}`
    : units === 'cm' ? `${chestCm} cm` : `${chest}"`;

  const printLabels = {
    titleLabel: `Knit-Helper 4000: ${CATEGORY_POSSESSIVE[category]} Sweater, ${titleSize}`,
    sizeLabel: `${category} ${sizeVal} ${sizeUnit}`,
    styleLabel: [
      method === 'hand' ? 'hand knitted' : 'machine knitted',
      neck === 'v' ? 'V-neck' : 'Crew neck',
      shoulder === 'drop' ? 'drop shoulder' : 'set-in sleeve',
      // "moderate ease", not a bare "moderate" — on paper the word has to carry
      // its own meaning, with no selector above it to say what it refers to.
      ease ? `${EASES.find((e) => e.id === ease)?.label.toLowerCase() ?? ''} ease` : '',
    ].filter(Boolean).join(' · '),
    gaugeLabel: `${gauge.st} sts / ${gauge.row} rows to ${gauge.span}`,
  };

  return (
    <>
      <header className="masthead">
        <div className="masthead-in">
          <h1 className="wordmark">Knit-Helper <span className="four">4000</span></h1>
          <div className="masthead-spacer" />
          <div className="seg" role="group" aria-label="Units">
            <button className={`pill ${units === 'in' ? 'on' : ''}`} onClick={() => setUnits('in')}>inches</button>
            <button className={`pill ${units === 'cm' ? 'on' : ''}`} onClick={() => setUnits('cm')}>cm</button>
          </div>
          <button className="ghost-btn" onClick={() => alert('Saving your patterns is coming next.')}>Load</button>
          <button className="ghost-btn" onClick={() => alert('Saving your patterns is coming next.')}>Save</button>
        </div>
      </header>

      <div className="page">
        {/* 2 — what & size */}
        <Section>
          <Tile title="What would you like to knit today?" className="grow2">
            <div className="btn-row">
              <Btn icon={<IconSweater />} label="Sweater" state="selected" />
              <Btn icon={<IconCardigan />} label="Cardigan" state="soon" />
              <Btn icon={<IconSkirt />} label="Skirt" state="soon" />
              <Btn icon={<IconDog />} label="Dog jumper" state="soon" />
            </div>
          </Tile>
          <Tile title="Size">
            <div className="sizepick">
              <div className="btn-row">
                <Btn icon={<IconBaby />} label="Baby" state={category === 'Baby' ? 'selected' : 'normal'} onClick={() => chooseCategory('Baby')} />
                <Btn icon={<IconChild />} label="Child" state={category === 'Child' ? 'selected' : 'normal'} onClick={() => chooseCategory('Child')} />
                <Btn icon={<IconWoman />} label="Woman" state={category === 'Woman' ? 'selected' : 'normal'} onClick={() => chooseCategory('Woman')} />
                <Btn icon={<IconMan />} label="Man" state={category === 'Man' ? 'selected' : 'normal'} onClick={() => chooseCategory('Man')} />
                <Btn icon={<IconCustom />} label="Custom" state="soon" />
              </div>
              <div className="slider-wrap">
                <input
                  type="range" min={chests[0]} max={chests[chests.length - 1]} step={2} value={chest}
                  onChange={(e) => setChest(Number(e.target.value))} aria-label="Chest size"
                />
                <span className="size-read">{sizeVal}<small>{sizeUnit}</small></span>
              </div>
            </div>
          </Tile>
        </Section>

        {/* 1 — technique */}
        <Section label="Technique" num={1}>
          <Tile title="Method">
            <div className="btn-row">
              <Btn icon={<IconMachine />} label="Machine" state={method === 'machine' ? 'selected' : 'normal'} onClick={() => setMethod('machine')} />
              <Btn icon={<IconHand />} label="Hand knit" state={method === 'hand' ? 'selected' : 'normal'} onClick={() => {
                setMethod('hand');
                // The roller templates vanish for hand; don't leave one selected.
                if (output === 'knitleader' || output === 'knitradar') setOutput('full');
              }} />
            </div>
          </Tile>
          {/* Construction is a hand-knitting choice. A domestic machine knits flat and
              bottom-up — in the round needs a ribber and is not what these patterns
              are — so offering the choice there would be offering a decision that
              isn't one. It appears when a hand technique is selected. */}
          {method !== 'machine' && (
            <Tile title="Construction">
              <div className="btn-row">
                <Btn label="Flat, bottom-up" state="selected" />
                <Btn label="In the round" state="soon" />
                <Btn label="Top-down" state="soon" />
              </div>
            </Tile>
          )}
        </Section>

        {/* 2 — tension */}
        <Section label="Tension" num={2}>
          <Tile title="Your swatch" className="full">
            <div className="swatch">
              My tension swatch measures{' '}
              <Measure inches={swatch.stDist} units={units} onChange={(v) => setSwatch({ ...swatch, stDist: v })} /> across{' '}
              <Count value={swatch.stCount} onChange={(n) => setSwatch({ ...swatch, stCount: n })} /> stitches, and{' '}
              <Measure inches={swatch.rowDist} units={units} onChange={(v) => setSwatch({ ...swatch, rowDist: v })} /> up{' '}
              <Count value={swatch.rowCount} onChange={(n) => setSwatch({ ...swatch, rowCount: n })} /> rows.{' '}
              <span style={{ color: '#f0dcc6', fontWeight: 700 }}>→ {gauge.st} sts × {gauge.row} rows / {gauge.span}</span>{' '}
              <button className="help-link" onClick={() => setHelp(true)}>How do I knit a swatch?</button>
            </div>
          </Tile>
        </Section>

        {/* 3 — body */}
        <Section label="Body" num={3}>
          <Tile title="Ease (how roomy)">
            <div className="btn-row">
              {EASES.map((e, i) => (
                <Btn key={e.id} icon={<IconEase level={i} />} label={e.label} state={ease === e.id ? 'selected' : 'normal'} onClick={() => setEase(e.id)} />
              ))}
            </div>
          </Tile>
          <Tile title="Length">
            <div className="btn-row">
              {BODY_LENGTHS.map((l, i) => (
                <Btn
                  key={l.id}
                  icon={<IconLength level={i} />}
                  label={l.label}
                  state={!lengthOk(l.id) ? 'blocked' : effBodyLength === l.id ? 'selected' : 'normal'}
                  onClick={() => setBodyLength(l.id)}
                />
              ))}
            </div>
          </Tile>
          <Tile title="Hem">
            <div className="btn-row">
              {HEMS.map((h) => (
                <Btn
                  key={h.id}
                  label={h.label}
                  state={!hemOk(h.id) ? 'blocked' : effHem === h.id ? 'selected' : 'normal'}
                  onClick={() => setHem(h.id)}
                />
              ))}
            </div>
          </Tile>
        </Section>

        {/* 4 — neckline & collar */}
        <Section label="Neckline &amp; collar" num={4}>
          <Tile title="Front neckline">
            <div className="btn-row" style={flatFromCollar ? { opacity: 0.45, pointerEvents: 'none' } : undefined}>
              <Btn icon={<IconNeck shape="round" />} label="Crew" state={neck === 'round' ? 'selected' : 'normal'} onClick={() => setNeck('round')} />
              <Btn icon={<IconNeck shape="v" />} label="V-neck" state={neck === 'v' ? 'selected' : 'normal'} onClick={() => setNeck('v')} />
              <Btn icon={<IconNeck shape="scoop" />} label="Scoop" state={neck === 'scoop' ? 'selected' : 'normal'} onClick={() => setNeck('scoop')} />
              <Btn icon={<IconNeck shape="high_round" />} label="High round" state={!highRoundFrontOk ? 'blocked' : effNeck === 'high_round' ? 'selected' : 'normal'} onClick={() => setNeck('high_round')} />
              <Btn icon={<IconNeck shape="shallow" />} label="Shallow" state="soon" />
              <Btn icon={<IconNeck shape="square" />} label="Square" state={neck === 'square' ? 'selected' : 'normal'} onClick={() => setNeck('square')} />
              {/* A boat is a whole-neck mode: selecting it makes front and back the same piece. */}
              <Btn icon={<IconNeck shape="boat" />} label="Boat" state={neck === 'boat' ? 'selected' : 'normal'} onClick={() => setNeck('boat')} />
              <Btn icon={<IconNeck shape="ballet" />} label="Ballet" state="soon" />
              <Btn icon={<IconNeck shape="keyhole" />} label="Keyhole" state="soon" />
            </div>
            {flatFromCollar && (
              <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginTop: 8 }}>Set to a flat neckline by the {effCollar} collar.</div>
            )}
          </Tile>
          <Tile title="Back neckline">
            <div className="btn-row">
              <Btn icon={<IconNeck shape="round" />} label="Round" state="soon" />
              <Btn icon={<IconNeck shape="high_round" />} label="High round" state={!highRoundBackOk ? 'blocked' : effBackNeck === 'high_round' ? 'selected' : 'normal'} onClick={() => pickBack('high_round')} />
              <Btn icon={<IconNeck shape="v" />} label="V" state="soon" />
              <Btn icon={<IconNeck shape="scoop" />} label="Scoop" state={effBackNeck === 'scoop' ? 'selected' : 'normal'} onClick={() => pickBack('scoop')} />
              <Btn icon={<IconNeck shape="shallow" />} label="Shallow" state="soon" />
              <Btn icon={<IconNeck shape="flat" />} label="Flat" state={!flatBackOk ? 'blocked' : effBackNeck === 'flat' ? 'selected' : 'normal'} onClick={() => pickBack('flat')} />
              <Btn icon={<IconNeck shape="square" />} label="Square" state={effBackNeck === 'square' ? 'selected' : 'normal'} onClick={() => pickBack('square')} />
              {/* A boat locks front and back together — selecting it here sets the whole neck. */}
              <Btn icon={<IconNeck shape="boat" />} label="Boat" state={effBackNeck === 'boat' ? 'selected' : 'normal'} onClick={() => setNeck('boat')} />
              <Btn icon={<IconNeck shape="ballet" />} label="Ballet" state="soon" />
              <Btn icon={<IconNeck shape="backless" />} label="Backless" state="soon" />
            </div>
          </Tile>
          <Tile title="Collar">
            <div className="btn-row">
              <Btn label="Single band" state={effCollar === 'single_band' ? 'selected' : 'normal'} onClick={() => setCollarStyle('single_band')} />
              <Btn label="Double band" state={!collarOk('double_band') ? 'blocked' : effCollar === 'double_band' ? 'selected' : 'normal'} onClick={() => setCollarStyle('double_band')} />
              <Btn label="Turtleneck" state={!collarOk('turtleneck') ? 'blocked' : effCollar === 'turtleneck' ? 'selected' : 'normal'} onClick={() => setCollarStyle('turtleneck')} />
              <Btn label="Cowl" state={!collarOk('cowl') ? 'blocked' : effCollar === 'cowl' ? 'selected' : 'normal'} onClick={() => setCollarStyle('cowl')} />
              <Btn label="Funnel" state={!collarOk('funnel') ? 'blocked' : effCollar === 'funnel' ? 'selected' : 'normal'} onClick={() => setCollarStyle('funnel')} />
              <Btn label="Rolled edge" state={!collarOk('rolled_edge') ? 'blocked' : effCollar === 'rolled_edge' ? 'selected' : 'normal'} onClick={() => setCollarStyle('rolled_edge')} />
              <Btn label="Shirt" state="soon" />
              <Btn label="Shawl" state="soon" />
              <Btn label="Hood" state="soon" />
              <Btn label="No collar" state={effCollar === 'none' ? 'selected' : 'normal'} onClick={() => setCollarStyle('none')} />
            </div>
            {flatFromCollar && (
              <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginTop: 8 }}>A {effCollar} collar sets a flat neckline (it clears the head).</div>
            )}
            {neck === 'boat' && (
              <div style={{ fontSize: '.82rem', color: 'var(--ink-soft)', marginTop: 8 }}>A boat neck takes a single band only.</div>
            )}
          </Tile>
        </Section>

        {/* 5 — shoulders & sleeves */}
        <Section label="Shoulders &amp; sleeves" num={5}>
          <Tile title="Shoulder">
            <div className="btn-row">
              <Btn icon={<IconShoulderStyle style="set_in" />} label="Set-in" state={effShoulder === 'set_in' ? 'selected' : 'normal'} onClick={() => setShoulder('set_in')} />
              <Btn icon={<IconShoulderStyle style="drop" />} label="Drop" state={effShoulder === 'drop' ? 'selected' : 'normal'} onClick={() => setShoulder('drop')} />
              <Btn icon={<IconShoulderStyle style="raglan" />} label="Raglan" state={boat ? 'blocked' : shoulder === 'raglan' ? 'selected' : 'normal'} onClick={() => setShoulder('raglan')} />
              <Btn icon={<IconShoulderStyle style="saddle" />} label="Saddle" state={boat ? 'blocked' : shoulder === 'saddle' ? 'selected' : 'normal'} onClick={() => setShoulder('saddle')} />

              <Btn icon={<IconShoulderStyle style="modified_drop" />} label="Modified drop" state="soon" />
              <Btn icon={<IconShoulderStyle style="drop_grafted" />} label="Drop grafted" state="soon" />
              <Btn icon={<IconShoulderStyle style="round_yoke" />} label="Round yoke" state="soon" />
            </div>
          </Tile>
          <Tile title="Sleeve length">
            <div className="btn-row">
              {SLEEVE_LENGTHS.map((l) => (
                <Btn
                  key={l.id}
                  icon={<IconSleeveLen len={l.id} />}
                  label={l.label}
                  state={!sleeveOk(l.id) ? 'blocked' : effSleeveLength === l.id ? 'selected' : 'normal'}
                  onClick={() => setSleeveLength(l.id)}
                />
              ))}
            </div>
          </Tile>
          <Tile title="Sleeve style">
            <div className="btn-row">
              <Btn icon={<IconSleeveShape style="moderate_taper" />} label="Taper" state={effSleeveStyle === 'moderate_taper' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('moderate_taper')} />
              <Btn icon={<IconSleeveShape style="narrow_taper" />} label="Narrow taper" state={!shapeOk('narrow_taper') ? 'blocked' : effSleeveStyle === 'narrow_taper' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('narrow_taper')} />
              <Btn icon={<IconSleeveShape style="lantern" />} label="Lantern" state={!shapeOk('lantern') ? 'blocked' : effSleeveStyle === 'lantern' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('lantern')} />
              <Btn icon={<IconSleeveShape style="modified_lantern" />} label="Modified lantern" state={!shapeOk('modified_lantern') ? 'blocked' : effSleeveStyle === 'modified_lantern' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('modified_lantern')} />
              <Btn icon={<IconSleeveShape style="bishop" />} label="Bishop" state={!shapeOk('bishop') ? 'blocked' : effSleeveStyle === 'bishop' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('bishop')} />
              <Btn icon={<IconSleeveShape style="bell" />} label="Bell" state={!shapeOk('bell') ? 'blocked' : effSleeveStyle === 'bell' ? 'selected' : 'normal'} onClick={() => setSleeveStyle('bell')} />
              <Btn icon={<IconSleeveShape style="dolman" />} label="Dolman" state="soon" />
            </div>
          </Tile>
        </Section>

        {/* output choice */}
        <Section label="Output" num={6}>
          <Tile title="What do you want to see?" className="full">
            <div className="btn-row">
              <Btn icon={<IconDocFull />} label="Full written" state={output === 'full' ? 'selected' : 'normal'} onClick={() => setOutput('full')} />
              <Btn icon={<IconDocShort />} label="Concise" state={output === 'concise' ? 'selected' : 'normal'} onClick={() => setOutput('concise')} />
              <Btn icon={<IconChart />} label="Knit chart" state={output === 'chart' ? 'selected' : 'normal'} onClick={() => setOutput('chart')} />
              {/* The roller templates drive a KnitLeader or KnitRadar — machine
                  accessories. There is nothing to feed them by hand. */}
              {method === 'machine' && (
                <>
                  <Btn icon={<IconRoller />} label="KnitLeader ½" state={output === 'knitleader' ? 'selected' : 'normal'} onClick={() => setOutput('knitleader')} />
                  <Btn icon={<IconRoller />} label="KnitRadar ¼" state={output === 'knitradar' ? 'selected' : 'normal'} onClick={() => setOutput('knitradar')} />
                </>
              )}
            </div>
          </Tile>
        </Section>

        {/* 7 — the pattern */}
        <Section label="Your pattern" num={7}>
          {!schematics || !patternText ? (
            <Tile className="full"><div className="notice err">Couldn’t find that size. Try another.</div></Tile>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Tile title="Which piece?" className="full">
                <div className="piece-tabs">
                  {pieceTabs.map((p) => (
                    <Btn key={p.id} label={p.label} state={shownPiece === p.id ? 'selected' : 'normal'} onClick={() => setPiece(p.id)} />
                  ))}
                </div>
              </Tile>
              {templateOnly ? (
                <>
                  <div className="diagram" dangerouslySetInnerHTML={{ __html: diagramSvg(shownPiece, scaleFactor) }} />
                  <p style={{ fontSize: '.85rem', color: 'var(--ink-soft)', marginTop: 10 }}>
                    Print at 100% (no scaling) and feed through the {output === 'knitleader' ? 'KnitLeader (½ scale)' : 'KnitRadar (¼ scale)'}. The 10&nbsp;cm calibration line checks your print came out true.
                  </p>
                </>
              ) : (
                <div className="output-cols">
                  {output === 'chart'
                    ? <div className="diagram" dangerouslySetInnerHTML={{ __html: chartSvg(shownPiece) }} />
                    : <div className="pattern">{patternText}</div>}
                  <FittedDiagram
                    metrics={screenMetrics(shownPiece)}
                    svgAt={(f) => screenDiagramSvg(shownPiece, f)}
                  />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 8 — print */}
        <Section label="Print" num={8}>
          <Tile className="full">
            <div className="btn-row">
              <Btn
                icon={<IconPrint />}
                label={templateOnly ? 'Print the templates' : output === 'chart' ? 'Print the charts' : 'Print the pattern'}
                state={printPattern ? 'normal' : 'blocked'}
                onClick={() => window.print()}
              />
            </div>
            {/* Paper governs the whole document, not just the templates: the full-page
                blocking diagrams are rendered to fit the sheet they will print on. */}
            <div style={{ marginTop: 12 }}>
              <div className="btn-row">
                {PAPERS.map((p) => (
                  <Btn
                    key={p.id}
                    label={p.label}
                    state={paper === p.id ? 'selected' : 'normal'}
                    onClick={() => setPaper(p.id)}
                  />
                ))}
                <Btn
                  label="Landscape"
                  state={landscape ? 'selected' : 'normal'}
                  onClick={() => setLandscape(!landscape)}
                />
              </div>
            </div>
            <p style={{ fontSize: '.85rem', color: 'var(--ink-soft)', marginTop: 10 }}>
              {templateOnly ? (
                <>
                  Each piece is cut into sheets you tape together — the Back takes{' '}
                  <strong>{backPlanTiles ? describePlan(backPlanTiles) : '—'}</strong> on{' '}
                  {paperRec.label}
                  {landscape ? ' landscape' : ''}. Choose the same paper in the print
                  dialogue. Every sheet is smaller than the page, so the scale setting
                  should not matter — but check the 10&nbsp;cm line with a ruler before
                  you knit to it.
                </>
              ) : (
                output === 'chart' ? (
                  <>
                    Every piece&rsquo;s chart on its own sheet, then the making up and a
                    full-page blocking diagram for each. Choose &ldquo;Save as PDF&rdquo;
                    in the print dialogue to keep a copy.
                  </>
                ) : (
                  <>
                    Prints every piece, the making up, and a full-page blocking diagram
                    for each — not just the piece shown above. Choose &ldquo;Save as
                    PDF&rdquo; in the print dialogue to keep a copy.
                  </>
                )
              )}
            </p>
          </Tile>
        </Section>

        <footer className="foot">Knit-Helper 4000 — sweaters, standard sizes. More garments and custom sizes on the way.</footer>
      </div>

      {/* The print document: off-screen always, revealed only by @media print. */}
      {printPattern && (
        <PrintDoc
          pattern={printPattern}
          mode={templateOnly ? 'templates' : output === 'chart' ? 'chart' : 'prose'}
          twoColumn={output === 'concise'}
          chartFor={chartSvg}
          handBand={technique === 'hand'}
          omitPieces={isBoat ? ['front', 'neckband'] : effCollar === 'none' ? ['neckband'] : []}
          tilePlanFor={tilePlanFor}
          sheetRoomMm={sheetRoomMm}
          pageHeightMm={pageHeightMm}
          chartBandsFor={chartBandsFor}
          blockingSvgFor={printBlockingSvg}
          paperLabel={paperRec.label}
          landscape={landscape}
          svgFor={(pid) => printDiagramSvg(pid, scaleFactor)}
          titleLabel={printLabels.titleLabel}
          sizeLabel={printLabels.sizeLabel}
          styleLabel={printLabels.styleLabel}
          gaugeLabel={printLabels.gaugeLabel}
          units={units}
          templateLabel={
            templateOnly
              ? `${output === 'knitleader' ? 'KnitLeader — half scale' : 'KnitRadar — quarter scale'}. Print at 100%; the 10 cm line checks it came out true.`
              : undefined
          }
        />
      )}

      {help && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,45,.6)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setHelp(false)}>
          <div className="tile plain" style={{ maxWidth: 560, maxHeight: '86vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="tile-title">Knitting a tension swatch</div>

            <p>
              <strong>Count first, then measure.</strong> Most patterns tell you to count
              stitches across four inches. Do it the other way round: fix the number of
              stitches and measure how far they reach. A miscount can only ever be half a
              stitch, so spreading it over {swatch.stCount} stitches instead of a handful
              makes the error small — and a ruler reads far finer than a stitch count can.
            </p>
            <p>
              Both boxes matter. This generator gives you numbered rows, not &ldquo;knit
              until it looks right&rdquo;, so the <strong>row</strong> figure carries as
              much weight as the stitch one.
            </p>

            <h3 style={{ fontFamily: 'var(--serif)', margin: '16px 0 6px', color: 'var(--navy)' }}>On a machine</h3>
            <p>
              Knit a band well wider than you need. Mark your count by knitting a couple of
              rows in a contrast colour, then {swatch.rowCount} rows of your yarn, then
              contrast again — the marked block is what you measure. Take the swatch off on
              waste yarn rather than casting it off: a cast-off edge locks the fabric and
              stops it relaxing, which is the thing you are trying to measure.
            </p>
            <p>
              Hang the same weight you will use for the garment, and leave the swatch to
              rest before measuring — a few hours at least, longer for wool. Lay it flat and
              let it settle into its own shape; do not pin it out.
            </p>
            <p style={{ fontSize: '.9rem', color: 'var(--ink-soft)' }}>
              Note your tension dial setting by marking it in the fabric, not on paper. Dial
              numbers do not carry across machines — two of the same model can differ — so
              the number is only ever a note to yourself.
            </p>

            <h3 style={{ fontFamily: 'var(--serif)', margin: '16px 0 6px', color: 'var(--navy)' }}>By hand</h3>
            <p>
              Cast on about half as many stitches again as you mean to measure, so the count
              sits in the middle away from the edges — the outermost stitches are always
              looser. Aim for at least 15&nbsp;cm square. Work it in the stitch you will use
              for the garment, on the needles you mean to use.
            </p>
            <p>
              Then treat it exactly as you will treat the finished garment. If you will wash
              the jumper, wash the swatch: soaking and drying can change a fabric by several
              per cent, where a steam press often changes it barely at all. Whichever you
              choose, the garment gets the same.
            </p>
            <p>
              Measure once it is dry, in the middle of the fabric, without stretching it.
            </p>
            <p style={{ fontSize: '.9rem', color: 'var(--ink-soft)' }}>
              If you knit your garment in the round, swatch in the round too. Most knitters
              purl at a different tension from the way they knit, so a flat swatch can be
              out by a sixth against the tube it is meant to predict.
            </p>

            <button className="ghost-btn" style={{ background: 'var(--navy)' }} onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
