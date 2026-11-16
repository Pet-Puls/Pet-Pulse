import { ApiError } from '@workspace/api-client-react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/config', () => ({ basePath: '', apiBaseUrl: '' }));

import { errorMessage } from '../src/components/app-shared';

describe('error messages', () => {
  it('shows the server explanation without the HTTP status', () => {
    const error = new ApiError(
      new Response(null, { status: 400, statusText: 'Bad Request' }),
      { error: 'El horario solicitado está fuera de la disponibilidad del proveedor.' },
      { method: 'POST', url: '/api/appointments' },
    );
    expect(errorMessage(error)).toBe('El horario solicitado está fuera de la disponibilidad del proveedor.');
    expect(error.status).toBe(400);
  });

  it('gives a readable message when the server does not provide one', () => {
    const error = new ApiError(
      new Response(null, { status: 500 }),
      null,
      { method: 'GET', url: '/api/appointments' },
    );
    expect(errorMessage(error)).toBe('No pudimos completar la solicitud. Inténtalo de nuevo.');
    expect(errorMessage(new Error('Sin conexión'))).toBe('Sin conexión');
  });
});
