import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: false },
  ready: true,
  me: { isLoading: false, isError: false, data: undefined as { onboardingCompleted: boolean } | undefined },
}));

vi.mock('@clerk/react', () => ({
  useAuth: () => state.auth,
  SignIn: () => 'Formulario de acceso',
  SignUp: () => 'Formulario de registro',
}));
vi.mock('@workspace/api-client-react', () => ({
  getGetMeQueryKey: () => ['me'],
  useGetMe: () => state.me,
}));
vi.mock('@/app/auth', () => ({ useApiAuthReady: () => state.ready }));
vi.mock('@/app/config', () => ({ basePath: '' }));
vi.mock('@/components/app-shared', () => ({
  ActionLink: ({ children }: { children: React.ReactNode }) => children,
  Brand: () => 'PetPulse',
  ErrorPanel: () => 'Error de conexión',
  LoadingPanel: () => 'Cargando sesión',
  errorMessage: () => 'Error de conexión',
}));
vi.mock('wouter', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: ({ to }: { to: string }) => `Redirigir a ${to}`,
}));

import PublicHomePage from '../src/pages/PublicHomePage';
import { SignInPage, SignUpPage } from '../src/pages/AuthPages';

beforeEach(() => {
  state.auth = { isLoaded: true, isSignedIn: false };
  state.ready = true;
  state.me = { isLoading: false, isError: false, data: undefined };
});

describe('navigation with an active session', () => {
  it('does not render the public home while the session is being checked', () => {
    state.auth = { isLoaded: false, isSignedIn: false };
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Cargando sesión');

    state.auth = { isLoaded: true, isSignedIn: true };
    state.ready = false;
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Cargando sesión');

    state.ready = true;
    state.me.isLoading = true;
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Cargando sesión');
  });

  it('redirects signed-in users to their workspace or onboarding', () => {
    state.auth = { isLoaded: true, isSignedIn: true };
    state.me.data = { onboardingCompleted: true };
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Redirigir a /workspace');
    state.me.data = { onboardingCompleted: false };
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Redirigir a /onboarding');
    expect(renderToStaticMarkup(<SignInPage/>)).toContain('Redirigir a /workspace');
    expect(renderToStaticMarkup(<SignUpPage/>)).toContain('Redirigir a /workspace');
  });

  it('allows signed-out visitors to access the registration and sign-in forms', () => {
    expect(renderToStaticMarkup(<SignInPage/>)).toContain('Formulario de acceso');
    expect(renderToStaticMarkup(<SignUpPage/>)).toContain('Formulario de registro');
  });

  it('shows an error instead of the public home when the profile cannot load', () => {
    state.auth = { isLoaded: true, isSignedIn: true };
    state.me.isError = true;
    expect(renderToStaticMarkup(<PublicHomePage/>)).toContain('Error de conexión');
  });
});
