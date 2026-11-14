import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, initialTheme } from '../src/components/AppPreferences';

afterEach(() => vi.unstubAllGlobals());

describe('theme preference', () => {
  it('restores a saved dark theme and coordinates browser color', () => {
    const storage = { getItem: vi.fn().mockReturnValue('dark'), setItem: vi.fn() };
    const meta = { setAttribute: vi.fn() };
    const root = { dataset: { theme: '' } };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { documentElement: root, querySelector: vi.fn().mockReturnValue(meta) });

    applyTheme(initialTheme());

    expect(root.dataset.theme).toBe('dark');
    expect(meta.setAttribute).toHaveBeenCalledWith('content', '#142d28');
    expect(storage.setItem).toHaveBeenCalledWith('petpulse-theme', 'dark');
  });

  it('defaults to light for an unknown stored value', () => {
    vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue('unknown') });
    expect(initialTheme()).toBe('light');
  });
});
