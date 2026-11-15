import type { ListPublicProvidersCategory } from '@workspace/api-client-react';

export const providerCategories = [
  ['veterinary', 'Veterinaria'],
  ['daycare', 'Guardería'],
  ['walker', 'Paseador/a'],
  ['shelter', 'Refugio'],
  ['store', 'Tienda'],
  ['other', 'Otro'],
] as const satisfies ReadonlyArray<readonly [ListPublicProvidersCategory, string]>;

export function getProviderCategoryLabel(category: ListPublicProvidersCategory) {
  return providerCategories.find(([value]) => value === category)?.[1] ?? category;
}
