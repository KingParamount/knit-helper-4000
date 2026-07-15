import { ENGINE_VERSION } from '@knit-helper-4000/engine';

export function App() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '40rem',
        margin: '4rem auto',
        padding: '0 1rem',
        lineHeight: 1.5,
      }}
    >
      <h1>Knit-Helper 4000</h1>
      <p>A knitting pattern generator. Nothing to see yet — the scaffold is live.</p>
      <p style={{ color: 'grey', fontSize: '0.85rem' }}>
        engine v{ENGINE_VERSION}
      </p>
    </main>
  );
}
