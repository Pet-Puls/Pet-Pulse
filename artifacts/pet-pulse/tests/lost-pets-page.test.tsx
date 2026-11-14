import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LostPetReport, MeProfile, PetProfile } from '@workspace/api-client-react';

const state = vi.hoisted(() => ({
  pets: [] as PetProfile[],
  reports: [] as LostPetReport[],
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@workspace/api-client-react', () => ({
  getListLostPetReportsQueryKey: () => ['reports'],
  getListPetsQueryKey: () => ['pets'],
  useListLostPetReports: () => ({ data: state.reports, isLoading: false, isError: false }),
  useListPets: () => ({ data: state.pets, isLoading: false, isError: false }),
  useCloseLostPetReport: () => ({ isPending: false }),
  useCreateLostPetReport: () => ({ isPending: false }),
  useRenewLostPetReport: () => ({ isPending: false }),
}));

vi.mock('@/components/app-shared', async () => {
  const { createElement } = await import('react');
  return {
    ActionLink: ({ children }: { children: React.ReactNode }) => createElement('a', null, children),
    ErrorPanel: () => null,
    LoadingPanel: () => null,
    PageHeading: ({ title }: { title: string }) => createElement('h1', null, title),
    errorMessage: () => 'Error',
  };
});

import LostPetsPage from '../src/pages/LostPetsPage';

const me: MeProfile = {
  id: 'owner',
  email: 'qa@example.test',
  displayName: 'QA',
  role: 'owner',
  onboardingCompleted: true,
  providerStatus: 'none',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const pet: PetProfile = {
  id: 'pet',
  name: 'Mascota QA',
  species: 'Perro',
  breed: null,
  age: null,
  emergencyContact: null,
  photoUrl: null,
  qrEnabled: false,
  shareEmergencyContact: false,
  status: 'lost',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const report: LostPetReport = {
  id: 'report',
  petId: pet.id,
  petName: pet.name,
  species: pet.species,
  breed: null,
  photoUrl: null,
  locationDescription: 'Sector de prueba',
  lastSeenAt: '2026-01-01T00:00:00Z',
  notes: null,
  expiresAt: '2026-01-04T00:00:00Z',
  status: 'active',
  canManage: true,
};

beforeEach(() => {
  state.pets = [];
  state.reports = [];
});

describe('LostPetsPage', () => {
  it('does not render a stray zero when the owner has no pets', () => {
    const html = renderToStaticMarkup(<LostPetsPage me={me}/>);

    expect(html).toContain('Primero agrega una mascota');
    expect(html).toContain('Reportes de la comunidad');
    expect(html).not.toMatch(/<\/section>0<section/);
  });

  it('explains that an active report can be renewed after it expires', () => {
    state.pets = [pet];
    state.reports = [report];
    const html = renderToStaticMarkup(<LostPetsPage me={me}/>);

    expect(html).toContain('Todas tus mascotas ya tienen un reporte activo');
    expect(html).toContain('renovarlo cuando venza');
    expect(html).toContain('Marcar encontrada y cerrar');
    expect(html).not.toContain('Renovar búsqueda');
  });
});
