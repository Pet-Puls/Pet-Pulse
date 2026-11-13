import { afterEach, describe, expect, it, vi } from "vitest";
import {
  setAuthTokenGetter,
  setBaseUrl,
} from "../src/custom-fetch";
import { listPublicProvidersValidated } from "../src/public-providers";

const providerPage = {
  items: [{
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Clinica Huellitas",
    category: "veterinary",
    neighborhood: "Centro",
    description: null,
    websiteUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    whatsappUrl: null,
    services: [{
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Consulta",
      description: null,
      durationMinutes: 45,
      priceCop: null,
    }],
    availability: {
      timezone: "America/Bogota",
      weeklyWindows: [],
      exceptions: [{
        date: "2026-06-15",
        isClosed: true,
        windows: [],
      }],
    },
  }],
  total: 1,
  page: 2,
  pageSize: 12,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  setAuthTokenGetter(null);
  setBaseUrl(null);
  vi.restoreAllMocks();
});

describe("listPublicProvidersValidated", () => {
  it("serializes search parameters, skips auth, and validates the response", async () => {
    const tokenGetter = vi.fn(() => "test-token");
    setAuthTokenGetter(tokenGetter);
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(providerPage));

    const result = await listPublicProvidersValidated({
      q: "Centro & parque",
      category: "veterinary",
      page: 2,
      pageSize: 12,
    });

    const [input, init] = fetch.mock.calls[0] ?? [];
    const url = new URL(String(input), "http://localhost");
    const headers = new Headers(init?.headers);

    expect(url.pathname).toBe("/api/providers");
    expect(url.searchParams.get("q")).toBe("Centro & parque");
    expect(url.searchParams.get("category")).toBe("veterinary");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("12");
    expect(tokenGetter).not.toHaveBeenCalled();
    expect(headers.has("authorization")).toBe(false);
    expect(result).toEqual(providerPage);
  });

  it("rejects a response that does not match the public contract", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({
      items: [{ name: "Perfil incompleto" }],
      total: 1,
      page: 1,
      pageSize: 12,
    }));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(listPublicProvidersValidated({ page: 1, pageSize: 12 }))
      .rejects.toThrow("No pudimos mostrar el directorio por una respuesta inesperada.");

    expect(errorLog).toHaveBeenCalledOnce();
  });

  it("preserves HTTP failures instead of returning an empty directory", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(
      { error: "Servicio temporalmente no disponible" },
      503,
    ));

    await expect(listPublicProvidersValidated({ page: 1, pageSize: 12 }))
      .rejects.toMatchObject({
        name: "ApiError",
        status: 503,
      });
  });
});
