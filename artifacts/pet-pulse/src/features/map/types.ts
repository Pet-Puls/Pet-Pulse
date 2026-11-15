export type Coordinates = { lat: number; lon: number };
export type PlaceCategory =
  | 'Veterinaria'
  | 'Tienda para mascotas'
  | 'Guardería'
  | 'Refugio'
  | 'Parque canino'
  | 'Parques y recreación'
  | 'Eventos y cultura'
  | 'Cafés y restaurantes'
  | 'Peluquería canina';
export type NearbyPlace = Coordinates & {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  distanceKm: number;
};
export type LocationResult = Coordinates & { id: string; label: string; detail: string };
export type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
  };
};

export const nearbyRadiusMeters = 5000;
export const medellinCenter = {
  lat: 6.2442,
  lon: -75.5812,
  label: 'Medellín, Antioquia',
};
export const categories: Array<'Todos' | PlaceCategory> = [
  'Todos',
  'Veterinaria',
  'Tienda para mascotas',
  'Guardería',
  'Peluquería canina',
  'Refugio',
  'Parque canino',
  'Parques y recreación',
  'Eventos y cultura',
  'Cafés y restaurantes',
];

export const placeTagGroups = [
  [
    'amenity:veterinary',
    'amenity:animal_boarding',
    'amenity:animal_shelter',
    'shop:pet',
    'craft:pet_grooming',
  ],
  [
    'leisure:dog_park',
    'leisure:park',
    'leisure:sports_centre',
    'leisure:stadium',
    'amenity:events_venue',
    'amenity:community_centre',
    'amenity:theatre',
    'amenity:arts_centre',
    'amenity:conference_centre',
    'amenity:cafe',
    'amenity:restaurant',
  ],
];
