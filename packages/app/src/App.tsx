import { useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { availableChests } from '@knit-helper-4000/engine';
import type { Category, Units, NeckStyle, ShoulderStyle } from '@knit-helper-4000/engine';
import {
  DEFAULT_SWATCH,
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
import './theme.css';

type OutputId = 'full' | 'concise' | 'chart' | 'knitleader' | 'knitradar';

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

  const input = { category, chest, units, ease, neck, shoulder, swatch };
  const gauge = gaugeReadout(gaugeFromSwatch(swatch));

  // Live outputs — the engine is pure and fast, so this runs every render.
  const patternText = useMemo(
    () => buildPatternText(input, output === 'concise' ? 'abbreviated' : 'verbose'),
    [category, chest, ease, neck, shoulder, swatch, output],
  );
  const schematics = useMemo(() => buildSchematics(input), [category, chest, ease, neck, shoulder, swatch]);

  const diagramSvg = (pid: PieceId, factor?: number): string =>
    schematics ? svgFor(schematics[pid], { scale: 'measured', units, grid: !factor, scaleFactor: factor }) : '';
  const chartSvg = (pid: PieceId): string =>
    schematics ? svgFor(schematics[pid], { scale: 'stitch', chart: true, grid: true }) : '';

  const scaleFactor = output === 'knitleader' ? 0.5 : output === 'knitradar' ? 0.25 : undefined;
  const templateOnly = output === 'knitleader' || output === 'knitradar';

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
              <strong>{swatch.stCount}</strong> stitches, and{' '}
              <Measure inches={swatch.rowDist} units={units} onChange={(v) => setSwatch({ ...swatch, rowDist: v })} /> up{' '}
              <strong>{swatch.rowCount}</strong> rows.{' '}
              <span style={{ color: '#f0dcc6', fontWeight: 700 }}>→ {gauge.st} sts × {gauge.row} rows / 4in</span>{' '}
              <button className="help-link" onClick={() => setHelp(true)}>How do I knit a swatch?</button>
            </div>
          </Tile>
        </Section>

        {/* 5 — technique */}
        <Section label="Technique">
          <Tile title="Method">
            <div className="btn-row">
              <Btn label="Machine" state="selected" />
              <Btn label="Hand knit" state="soon" />
              <Btn label="Crochet" state="soon" />
            </div>
          </Tile>
          <Tile title="Construction">
            <div className="btn-row">
              <Btn label="Flat, bottom-up" state="selected" />
              <Btn label="In the round" state="soon" />
              <Btn label="Top-down" state="soon" />
            </div>
          </Tile>
        </Section>

        {/* 6 — output choice */}
        <Section label="Output">
          <Tile title="What do you want to see?" className="full">
            <div className="btn-row">
              <Btn icon={<IconDocFull />} label="Full written" state={output === 'full' ? 'selected' : 'normal'} onClick={() => setOutput('full')} />
              <Btn icon={<IconDocShort />} label="Concise" state={output === 'concise' ? 'selected' : 'normal'} onClick={() => setOutput('concise')} />
              <Btn icon={<IconChart />} label="Knit chart" state={output === 'chart' ? 'selected' : 'normal'} onClick={() => setOutput('chart')} />
              <Btn icon={<IconRoller />} label="KnitLeader ½" state={output === 'knitleader' ? 'selected' : 'normal'} onClick={() => setOutput('knitleader')} />
              <Btn icon={<IconRoller />} label="KnitRadar ¼" state={output === 'knitradar' ? 'selected' : 'normal'} onClick={() => setOutput('knitradar')} />
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
                  <div className="diagram" dangerouslySetInnerHTML={{ __html: diagramSvg(piece) }} />
                </div>
              )}
            </div>
          )}
        </Section>

        {/* 8 — print */}
        <Section label="Print">
          <Tile className="full">
            <div className="btn-row">
              <Btn icon={<IconPrint />} label="Print this" state="normal" onClick={() => window.print()} />
            </div>
          </Tile>
        </Section>

        <footer className="foot">Knit-Helper 4000 — sweaters, standard sizes. More garments and custom sizes on the way.</footer>
      </div>

      {help && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,20,45,.6)', display: 'grid', placeItems: 'center', padding: 20 }} onClick={() => setHelp(false)}>
          <div className="tile plain" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="tile-title">Knitting a tension swatch</div>
            <p>Cast on a good handful of stitches and knit a square in stocking stitch. Let it rest (block it as you would the finished piece).</p>
            <p><strong>Measure over lots of stitches, not four inches.</strong> Lay a ruler across <strong>{swatch.stCount} stitches</strong> and read the distance; do the same up <strong>{swatch.rowCount} rows</strong>. Measuring over a big count makes small errors tiny.</p>
            <p>Type those two measurements above and Knit-Helper works out your gauge.</p>
            <button className="ghost-btn" style={{ background: 'var(--navy)' }} onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
