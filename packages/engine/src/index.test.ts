import { describe, it, expect } from 'vitest';
import { ENGINE_NAME, ENGINE_VERSION } from './index';

describe('engine scaffold', () => {
  it('exposes its name', () => {
    expect(ENGINE_NAME).toContain('Knit-Helper 4000');
  });

  it('exposes a version', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
