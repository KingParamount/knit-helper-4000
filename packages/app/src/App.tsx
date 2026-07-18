import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { availableChests, schematicMetrics } from '@knit-helper-4000/engine';
import type { Category, Units, NeckStyle, ShoulderStyle } from '@knit-helper-4000/engine';
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
  IconEase, IconCrew, IconVneck, IconShoulder, IconSleeve,
  IconDocFull, IconDocShort, IconChart, IconRoller, IconPrint,
} from './icons';
import { PrintDoc } from './PrintDoc';
import {
  PAPERS, planTiles, planBands, describePlan, fitScaleFactor, mmToPx, pxToMm,
  PATTERN_MARGIN_MM, DIAGRAM_HEAD_MM, type PaperId,
} from './tiling';
import './theme.css';

type OutputId = 'full' | 'concise' | 'chart' | 'knitleader' | 'knitradar';
/** How the garment is made. Only 'machine' is built; the others are on the way. */
type Method = 'machine' | 'hand' | 'crochet';

// ---- small building blocks --------------------------------------------------

function Section({ label, children }: { label?: string; children: ReactNode }): JSX.Element {
  return (
    <section className="section">
      {label && <div className="section-head">{label}</div>}
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
      <span className="unit">in</span>
      <span className="eighths">
        <span className="frac">{eighths}<span className="over">⁄8</span></span>
        <span className="stepper">
          <button onClick={() => setTotalEighths(whole * 8 + eighths + 1)} aria-label="up an eighth">▲</button>
          <button onClick={() => setTotalEighths(whole * 8 + eighths - 1)} aria-label="down an eighth">▼</button>
        </span>
      </span>
    </span>
  );
}

/**
 * A plain whole-number field, for the stitch and row COUNTS a swatch is measured
 * over. Distances get the eighths stepper (Measure); counts are just typed.
 */
function Count({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }): JSX.Element {
  return (
    <span className="numfield">
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
const CATEGORIES: Category[] = ['Baby', 'Child', 'Woman', 'Man'];
const PIECES: { id: PieceId; label: string }[] = [
  { id: 'back', label: 'Back' },
  { id: 'front', label: 'Front' },
  { id: 'sleeve', label: 'Sleeves' },
  { id: 'neckband', label: 'Neckband' },
];

export function App(): JSX.Element {
  const [units, setUnits] = useState<Units>('in');
  const [category, setCategory] = useState<Category>('Woman');
  const [chest, setChest] = useState(36);
  const [ease, setEase] = useState<EaseId>('moderate');
  const [neck, setNeck] = useState<NeckStyle>('round');
  const [shoulder, setShoulder] = useState<ShoulderStyle>('set_in');
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
  // Babies and children are sized by age, adults by chest.
  const young = category === 'Baby' || category === 'Child';
  const sizeRec = resolveSize(category, chest);
  const sizeVal = young
    ? category === 'Baby'
      ? (sizeRec?.age ?? '').replace('m', '')
      : sizeRec?.age ?? ''
    : units === 'cm'
      ? chestCm
      : chest;
  const sizeUnit = young ? (category === 'Baby' ? 'months' : 'years') : units === 'cm' ? 'cm chest' : 'in chest';

  // Crochet is not built, so it can never be the selected method; the cast keeps the
  // engine's narrower Technique honest rather than widening it to a value it cannot serve.
  const technique = method === 'hand' ? ('hand' as const) : ('machine' as const);
  const input = { category, chest, units, ease, neck, shoulder, swatch, technique };
  const gauge = gaugeReadout(gaugeFromSwatch(swatch), units);

  // Live outputs — the engine is pure and fast, so this runs every render.
  const patternText = useMemo(
    () => buildPatternText(input, output === 'concise' ? 'abbreviated' : 'verbose'),
    [category, chest, ease, neck, shoulder, swatch, output, technique],
  );
  const schematics = useMemo(() => buildSchematics(input), [category, chest, ease, neck, shoulder, swatch]);

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
    schematics ? svgFor(schematics[pid], { scale: 'stitch', chart: true, grid: true }) : '';

  const scaleFactor = output === 'knitleader' ? 0.5 : output === 'knitradar' ? 0.25 : undefined;
  const templateOnly = output === 'knitleader' || output === 'knitradar';

  // The printed sheet is its own document over the same engine output, so it carries
  // every piece regardless of which tab is open on screen. Concise stays concise.
  const printPattern = useMemo(
    () => buildPattern(input, output === 'concise' ? 'abbreviated' : 'verbose'),
    [category, chest, ease, neck, shoulder, swatch, output],
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

  const printLabels = {
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

        {/* 3 — shape */}
        <Section label="Shape">
          <Tile title="Ease (how roomy)">
            <div className="btn-row">
              {EASES.map((e, i) => (
                <Btn key={e.id} icon={<IconEase level={i} />} label={e.label} state={ease === e.id ? 'selected' : 'normal'} onClick={() => setEase(e.id)} />
              ))}
            </div>
          </Tile>
          <Tile title="Neckline">
            <div className="btn-row">
              <Btn icon={<IconCrew />} label="Crew" state={neck === 'round' ? 'selected' : 'normal'} onClick={() => setNeck('round')} />
              <Btn icon={<IconVneck />} label="V-neck" state={neck === 'v' ? 'selected' : 'normal'} onClick={() => setNeck('v')} />
              <Btn icon={<IconCrew />} label="Scoop" state="soon" />
              <Btn icon={<IconCrew />} label="Boat" state="soon" />
            </div>
          </Tile>
          <Tile title="Shoulder">
            <div className="btn-row">
              <Btn icon={<IconShoulder />} label="Set-in" state={shoulder === 'set_in' ? 'selected' : 'normal'} onClick={() => setShoulder('set_in')} />
              <Btn icon={<IconShoulder />} label="Drop" state={shoulder === 'drop' ? 'selected' : 'normal'} onClick={() => setShoulder('drop')} />
              <Btn icon={<IconShoulder />} label="Raglan" state="soon" />
              <Btn icon={<IconShoulder />} label="Saddle" state="soon" />
              <Btn icon={<IconShoulder />} label="Round yoke" state="soon" />
            </div>
          </Tile>
          <Tile title="Sleeve length">
            <div className="btn-row">
              <Btn icon={<IconSleeve />} label="Full" state="selected" />
              <Btn icon={<IconSleeve />} label="¾ length" state="soon" />
              <Btn icon={<IconSleeve />} label="Half" state="soon" />
              <Btn icon={<IconSleeve />} label="Short" state="soon" />
              <Btn icon={<IconSleeve />} label="Cap" state="soon" />
              <Btn icon={<IconSleeve />} label="Sleeveless" state="soon" />
            </div>
          </Tile>
        </Section>

        {/* 4 — tension */}
        <Section label="Tension">
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

        {/* 5 — technique */}
        <Section label="Technique">
          <Tile title="Method">
            <div className="btn-row">
              <Btn label="Machine" state={method === 'machine' ? 'selected' : 'normal'} onClick={() => setMethod('machine')} />
              <Btn label="Hand knit" state={method === 'hand' ? 'selected' : 'normal'} onClick={() => {
                setMethod('hand');
                // The roller templates vanish for hand; don't leave one selected.
                if (output === 'knitleader' || output === 'knitradar') setOutput('full');
              }} />
              <Btn label="Crochet" state="soon" />
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

        {/* 6 — output choice */}
        <Section label="Output">
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
        <Section label="Your pattern">
          {!schematics || !patternText ? (
            <Tile className="full"><div className="notice err">Couldn’t find that size. Try another.</div></Tile>
          ) : (
            <div style={{ width: '100%' }}>
              <div className="piece-tabs">
                {PIECES.map((p) => (
                  <Btn key={p.id} label={p.label} state={piece === p.id ? 'selected' : 'normal'} onClick={() => setPiece(p.id)} />
                ))}
              </div>
              {templateOnly ? (
                <>
                  <div className="diagram" dangerouslySetInnerHTML={{ __html: diagramSvg(piece, scaleFactor) }} />
                  <p style={{ fontSize: '.85rem', color: 'var(--ink-soft)', marginTop: 10 }}>
                    Print at 100% (no scaling) and feed through the {output === 'knitleader' ? 'KnitLeader (½ scale)' : 'KnitRadar (¼ scale)'}. The 10&nbsp;cm calibration line checks your print came out true.
                  </p>
                </>
              ) : (
                <div className="output-cols">
                  {output === 'chart'
                    ? <div className="diagram" dangerouslySetInnerHTML={{ __html: chartSvg(piece) }} />
                    : <div className="pattern">{patternText}</div>}
                  <FittedDiagram
                    metrics={screenMetrics(piece)}
                    svgAt={(f) => screenDiagramSvg(piece, f)}
                  />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 8 — print */}
        <Section label="Print">
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
          tilePlanFor={tilePlanFor}
          sheetRoomMm={sheetRoomMm}
          pageHeightMm={pageHeightMm}
          chartBandsFor={chartBandsFor}
          blockingSvgFor={printBlockingSvg}
          paperLabel={paperRec.label}
          landscape={landscape}
          svgFor={(pid) => printDiagramSvg(pid, scaleFactor)}
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
