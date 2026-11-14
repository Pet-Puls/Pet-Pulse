import { afterEach, expect, it, vi } from 'vitest';

vi.mock('@clerk/react/internal', () => ({ publishableKeyFromHost: () => 'test-key' }));
vi.mock('@workspace/api-client-react', () => ({ setBaseUrl: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('preserves Spanish sign-in, recovery and registration text with PetPulse titles', async () => {
  vi.stubGlobal('window', { location: { hostname: 'localhost', origin: 'http://localhost' } });
  const { clerkLocalization } = await import('../src/app/config');

  expect(clerkLocalization.signIn.start.title).toBe('Qué gusto verte');
  expect(clerkLocalization.signIn.start.actionText).toBe('¿No tienes cuenta?');
  expect(clerkLocalization.signIn.forgotPassword?.title).toBe('Restablecer contraseña');
  expect(clerkLocalization.signUp.start.title).toBe('Cuidemos en comunidad');
  expect(clerkLocalization.formFieldInputPlaceholder__signUpPassword).toBe('Crea una contraseña');
});
