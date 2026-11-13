import type {
  Coordinates, LocationResult, NearbyPlace, PhotonFeature,
} from './types';
import { nearbyRadiusMeters, placeTagGroups } from './types';

async function fetchWithTimeout(
  input: string,
  init?: RequestInit,
  timeoutMs = 20_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

function getPlaceCategory(tags: Record<string, string | undefined>) {
  if (tags.amenity === 'veterinary') return 'Veterinaria';
  if (tags.amenity === 'animal_boarding') return 'Guardería';
  if (tags.shop === 'pet') return 'Tienda para mascotas';
  if (tags.amenity === 'animal_shelter') return 'Refugio';
  if (tags.leisure === 'dog_park') return 'Parque canino';
  if (tags.leisure === 'park' || tags.leisure === 'sports_centre' || tags.leisure === 'stadium') return 'Parques y recreación';
  if (['events_venue', 'community_centre', 'theatre', 'arts_centre', 'conference_centre'].includes(tags.amenity ?? '')) {
    return 'Eventos y cultura';
  }
  if (tags.amenity === 'cafe' || tags.amenity === 'restaurant') return 'Cafés y restaurantes';
  if (tags.craft === 'pet_grooming') return 'Peluquería canina';
  return null;
}

function distanceBetween(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.lat - from.lat);
  const longitudeDelta = radians(to.lon - from.lon);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat))
      * Math.sin(longitudeDelta / 2) ** 2;
  const clampedValue = Math.min(1, Math.max(0, value));
  return 6371 * 2 * Math.atan2(Math.sqrt(clampedValue), Math.sqrt(1 - clampedValue));
}

function getFeatureCoordinates(feature: PhotonFeature): Coordinates | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates || coordinates.length < 2) return null;
  const [lon, lat] = coordinates;
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && Math.abs(lat) <= 90
    && Math.abs(lon) <= 180
    ? { lat, lon }
    : null;
}

function getFeatureAddress(properties: NonNullable<PhotonFeature['properties']>): string {
  return [
    [properties.street, properties.housenumber].filter(Boolean).join(' '),
    properties.district,
    properties.city,
    properties.state,
  ].filter((part, index, parts) => Boolean(part) && parts.indexOf(part) === index).join(', ');
}

export function getLocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'No se concedió permiso para la ubicación. Puedes buscar una ciudad o dirección manualmente.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'El dispositivo no pudo determinar la ubicación. Intenta buscar una ciudad o dirección.';
  }
  if (error.code === error.TIMEOUT) {
    return 'La solicitud de ubicación tardó demasiado. Inténtalo de nuevo o busca una dirección.';
  }
  return 'No pudimos obtener la ubicación del dispositivo.';
}

export async function searchNearbyPlaces(target: Coordinates): Promise<{
  places: NearbyPlace[];
  failedGroups: string[];
}> {
  const featureGroups: PhotonFeature[][] = [];
  const failedGroups: string[] = [];

  for (const tags of placeTagGroups) {
    const url = new URL('https://photon.komoot.io/reverse');
    url.searchParams.set('lat', `${target.lat}`);
    url.searchParams.set('lon', `${target.lon}`);
    url.searchParams.set('radius', `${nearbyRadiusMeters / 1000}`);
    url.searchParams.set('limit', '50');
    tags.forEach(tag => url.searchParams.append('osm_tag', tag));

    try {
      const response = await fetchWithTimeout(url.toString(), undefined, 12_000);
      if (!response.ok) throw new Error(`El servicio respondió con el estado ${response.status}.`);
      const data = await response.json() as { features?: PhotonFeature[] };
      if (!Array.isArray(data.features)) throw new Error('El servicio devolvió una respuesta inesperada.');
      featureGroups.push(data.features);
    } catch (caught) {
      failedGroups.push(caught instanceof Error && caught.name === 'AbortError'
        ? 'La búsqueda de lugares tardó demasiado.'
        : caught instanceof Error
          ? caught.message
          : 'No se pudo consultar el servicio de lugares.');
    }
  }

  if (!featureGroups.length) {
    throw new Error(`${failedGroups[0] ?? 'No se pudo consultar el servicio de lugares.'} Inténtalo de nuevo más tarde.`);
  }

  const places = featureGroups.flat().flatMap((feature): NearbyPlace[] => {
    const properties = feature.properties ?? {};
    const category = getPlaceCategory({ [properties.osm_key ?? '']: properties.osm_value });
    const coordinates = getFeatureCoordinates(feature);
    if (!coordinates || !category) return [];
    const distanceKm = distanceBetween(target, coordinates);
    if (distanceKm > nearbyRadiusMeters / 1000) return [];
    return [{
      id: `${properties.osm_type ?? 'place'}-${properties.osm_id ?? `${coordinates.lat}-${coordinates.lon}`}`,
      ...coordinates,
      name: properties.name?.trim() || category,
      category,
      address: getFeatureAddress(properties),
      distanceKm,
    }];
  }).filter((place, index, list) => list.findIndex(other => other.id === place.id) === index)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { places, failedGroups };
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '5');
  const response = await fetchWithTimeout(url.toString());
  if (!response.ok) throw new Error(`El servicio de búsqueda respondió con el estado ${response.status}.`);
  const data = await response.json() as { features?: PhotonFeature[] };
  if (!Array.isArray(data.features)) throw new Error('El servicio de búsqueda devolvió una respuesta inesperada.');

  return data.features.flatMap((feature, index): LocationResult[] => {
    const coordinates = getFeatureCoordinates(feature);
    if (!coordinates) return [];
    const properties = feature.properties ?? {};
    const label = properties.name
      || [properties.street, properties.housenumber].filter(Boolean).join(' ')
      || properties.city
      || 'Lugar seleccionado';
    const detail = [
      [properties.street, properties.housenumber].filter(Boolean).join(' '),
      properties.district,
      properties.city,
      properties.state,
      properties.country,
    ].filter((part, partIndex, parts) => Boolean(part) && parts.indexOf(part) === partIndex).join(', ');
    return [{ id: `${index}-${coordinates.lat}-${coordinates.lon}`, ...coordinates, label, detail }];
  });
}
