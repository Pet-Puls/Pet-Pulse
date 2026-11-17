import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PetProfile } from '@workspace/api-client-react';
import { formatPetAge, parsePetAge } from '@workspace/api-client-react';

vi.mock('@/app/config', () => ({ basePath: '', apiBaseUrl: '' }));
vi.mock('@/pages/WorkspaceHomePage', () => ({ PetSummary: () => null }));

import { PetEditor } from '../src/pages/PetsPage';

const pet: PetProfile = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Mascota de prueba',
  species: 'Cobaya',
  breed: null,
  age: 'joven',
  emergencyContact: null,
  photoUrl: null,
  qrEnabled: false,
  shareEmergencyContact: false,
  status: 'home',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function renderEditor(value?: PetProfile) {
  return renderToStaticMarkup(<PetEditor pet={value} onClose={() => {}} onSaved={() => {}} saving={false}/>);
}

describe('pet fields', () => {
  it('offers a species selection and numeric age with units', () => {
    const markup = renderEditor();
    expect(markup).toContain('Canino (perro)');
    expect(markup).toContain('Felino (gato)');
    expect(markup).toContain('value="Otro"');
    expect(markup).toMatch(/id="pet-age"[^>]*type="number"[^>]*min="0"[^>]*step="1"/);
    expect(markup).toContain('Unidad de edad');
  });

  it('keeps legacy values visible rather than replacing them', () => {
    const markup = renderEditor(pet);
    expect(markup).toContain('Cobaya (valor anterior)');
    expect(markup).toContain('Edad anterior: joven');
    expect(markup).toContain('Se conservará si no la cambias.');
    const numeric = renderEditor({ ...pet, species: 'Gato', age: '3 meses' });
    expect(numeric).toMatch(/id="pet-age"[^>]*value="3"/);
    expect(numeric).toMatch(/value="meses" selected/);
  });

  it('formats and parses whole-number ages without accepting invalid values', () => {
    expect(formatPetAge('1', 'años')).toBe('1 año');
    expect(formatPetAge('0', 'meses')).toBe('0 meses');
    expect(parsePetAge('3 meses')).toEqual({ value: '3', unit: 'meses' });
    for (const invalid of ['-1', '1.5', 'joven', '9007199254740992']) {
      expect(formatPetAge(invalid, 'años')).toBeNull();
    }
    expect(parsePetAge('joven')).toBeNull();
  });
});
