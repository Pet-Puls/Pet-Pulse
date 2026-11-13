import { useQuery } from "@tanstack/react-query";
import { ListPublicProvidersResponse } from "@workspace/api-zod";
import { customFetch } from "./custom-fetch";

export type {
  ListPublicProvidersCategory as PublicProviderCategory,
} from "./generated/api.schemas";
import type {
  ListPublicProvidersCategory,
  PublicProviderPage,
} from "./generated/api.schemas";

export type PublicProviderSearch = {
  q?: string;
  category?: ListPublicProvidersCategory;
  page: number;
  pageSize: number;
};

export async function listPublicProvidersValidated(
  search: PublicProviderSearch,
  signal?: AbortSignal,
): Promise<PublicProviderPage> {
  const params = new URLSearchParams({
    page: String(search.page),
    pageSize: String(search.pageSize),
  });
  if (search.q) params.set("q", search.q);
  if (search.category) params.set("category", search.category);

  const response = await customFetch<unknown>(
    `/api/providers?${params.toString()}`,
    {
      signal,
      responseType: "json",
      skipAuth: true,
    },
  );
  const parsed = ListPublicProvidersResponse.safeParse(response);
  if (!parsed.success) {
    console.error("Invalid public providers response", parsed.error);
    throw new Error(
      "No pudimos mostrar el directorio por una respuesta inesperada. Intenta de nuevo.",
    );
  }
  return parsed.data;
}

export function useListPublicProvidersValidated(search: PublicProviderSearch) {
  return useQuery({
    queryKey: ["public-providers", search],
    queryFn: ({ signal }) => listPublicProvidersValidated(search, signal),
    staleTime: 60_000,
  });
}
