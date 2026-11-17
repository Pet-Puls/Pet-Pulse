import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoApp } from '../src/DemoApp';

afterEach(() => vi.unstubAllGlobals());

describe('demo navigation', () => {
  it('links back to the main application outside the demo router', () => {
    vi.stubGlobal('location', { pathname: '/demo/map', search: '', hash: '' });
    const markup = renderToStaticMarkup(<DemoApp/>);
    expect(markup).toMatch(/<a class="demo-exit" href="\/">.*Salir de la demostración<\/a>/);
  });

  it('does not link to the main application from the standalone demo', () => {
    const markup = renderToStaticMarkup(<DemoApp standalone/>);
    expect(markup).not.toContain('Salir de la demostración');
  });
});
