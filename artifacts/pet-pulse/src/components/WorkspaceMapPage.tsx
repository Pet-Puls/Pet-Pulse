import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ExternalLink, LocateFixed, MapPin, Navigation, RefreshCw, Search,
} from 'lucide-react';
import {
  categories, medellinCenter, nearbyRadiusMeters,
} from '@/features/map/types';
import type {
  Coordinates, LocationResult, NearbyPlace,
} from '@/features/map/types';
import { getLocationError, searchLocations, searchNearbyPlaces } from '@/features/map/map-service';

export default function WorkspaceMapPage() {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const searchRequestId = useRef(0);
  const geocodeRequestId = useRef(0);
  const locationRequestId = useRef(0);
  const [center, setCenter] = useState<(Coordinates & { label: string }) | null>(medellinCenter);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [filter, setFilter] = useState<(typeof categories)[number]>('Todos');
  const [searchText, setSearchText] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [error, setError] = useState('');
  const [searchMessage, setSearchMessage] = useState('');

  const visiblePlaces = useMemo(
    () => filter === 'Todos' ? places : places.filter(place => place.category === filter),
    [filter, places],
  );

  useEffect(() => {
    if (!mapElement.current) return;
    const instance = L.map(mapElement.current, { scrollWheelZoom: true }).setView(
      [medellinCenter.lat, medellinCenter.lon],
      13,
    );
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    tiles.on('tileerror', () => setTileError(true));
    tiles.addTo(instance);
    tileLayer.current = tiles;
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const resizeFrame = window.requestAnimationFrame(() => instance.invalidateSize());

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      instance.remove();
      map.current = null;
      tileLayer.current = null;
      markers.current = null;
    };
  }, []);

  useEffect(() => {
    if (center && map.current) map.current.setView([center.lat, center.lon], 14);
  }, [center]);

  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();

    if (center) {
      L.circleMarker([center.lat, center.lon], {
        radius: 9,
        color: '#fff',
        weight: 3,
        fillColor: '#2865d8',
        fillOpacity: 1,
      }).bindTooltip('Ubicación seleccionada').addTo(layer);
    }

    visiblePlaces.forEach(place => {
      const marker = L.marker([place.lat, place.lon], {
        icon: L.divIcon({
          className: 'workspace-map-marker-wrap',
          html: '<span class="workspace-map-marker"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      }).addTo(layer);
      marker.bindTooltip(place.name);
      const popup = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = place.name;
      const detail = document.createElement('div');
      detail.textContent = `${place.category} · ${place.distanceKm.toFixed(1)} km`;
      popup.append(name, detail);
      marker.bindPopup(popup);
    });
  }, [center, visiblePlaces]);

  useEffect(() => () => {
    searchRequestId.current += 1;
    geocodeRequestId.current += 1;
    locationRequestId.current += 1;
  }, []);

  useEffect(() => {
    void searchNearby(medellinCenter);
  }, []);

  async function searchNearby(target: Coordinates & { label: string }) {
    const requestId = ++searchRequestId.current;
    setCenter(target);
    setPlaces([]);
    setError('');
    setSearchMessage('');
    setIsLoadingPlaces(true);

    try {
      const { places: results, failedGroups } = await searchNearbyPlaces(target);
      if (requestId !== searchRequestId.current) return;
      setPlaces(results);
      if (failedGroups.length) setError(`Se cargó solo parte del panorama de lugares. ${failedGroups.join(' ')}`);
      setSearchMessage(
        results.length
          ? `${results.length} lugares encontrados en un radio de ${nearbyRadiusMeters / 1000} km${failedGroups.length ? ' (resultados parciales)' : ''}.`
          : `No encontramos lugares etiquetados en OpenStreetMap en un radio de ${nearbyRadiusMeters / 1000} km.`,
      );
    } catch (caught) {
      if (requestId !== searchRequestId.current) return;
      setError(caught instanceof Error && caught.name === 'AbortError'
        ? 'La búsqueda de lugares tardó demasiado. Inténtalo de nuevo.'
        : caught instanceof Error
          ? caught.message
          : 'No pudimos consultar los lugares cercanos. Inténtalo de nuevo.');
    } finally {
      if (requestId === searchRequestId.current) setIsLoadingPlaces(false);
    }
  }

  function useDeviceLocation() {
    const requestId = ++locationRequestId.current;
    geocodeRequestId.current += 1;
    setError('');
    setSearchMessage('');
    setLocationResults([]);
    setIsSearching(false);
    if (!navigator.geolocation) {
      setError('Este navegador no ofrece geolocalización. Busca una ciudad o dirección.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== locationRequestId.current) return;
        setIsLocating(false);
        void searchNearby({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          label: 'Mi ubicación',
        });
      },
      locationError => {
        if (requestId !== locationRequestId.current) return;
        setIsLocating(false);
        setError(getLocationError(locationError));
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
    );
  }

  async function searchLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchText.trim();
    if (!query) return;

    locationRequestId.current += 1;
    const requestId = ++geocodeRequestId.current;
    setIsSearching(true);
    setError('');
    setSearchMessage('');
    setLocationResults([]);
    try {
      const results = await searchLocations(query);
      if (requestId !== geocodeRequestId.current) return;
      setLocationResults(results);
      if (!results.length) setSearchMessage('No encontramos esa ubicación. Prueba con otra búsqueda.');
    } catch (caught) {
      if (requestId !== geocodeRequestId.current) return;
      setError(caught instanceof Error && caught.name === 'AbortError'
        ? 'La búsqueda tardó demasiado. Inténtalo de nuevo.'
        : caught instanceof Error
          ? caught.message
          : 'No pudimos buscar esa ubicación. Inténtalo de nuevo.');
    } finally {
      if (requestId === geocodeRequestId.current) setIsSearching(false);
    }
  }

  function searchThisArea() {
    const mapCenter = map.current?.getCenter();
    if (!mapCenter) return;
    locationRequestId.current += 1;
    geocodeRequestId.current += 1;
    setLocationResults([]);
    setIsSearching(false);
    void searchNearby({
      lat: mapCenter.lat,
      lon: mapCenter.lng,
      label: 'Área del mapa',
    });
  }

  function retryMapTiles() {
    setTileError(false);
    tileLayer.current?.redraw();
  }

  return (
    <main className="account-content workspace-map-page">
      <div className="account-heading">
        <div>
          <div className="account-kicker">Explora tu zona</div>
          <h1>Mapa cercano</h1>
          <p>Busca veterinarias y otros lugares para el cuidado de mascotas cerca de ti.</p>
        </div>
        <button className="account-button" onClick={useDeviceLocation} disabled={isLocating || isLoadingPlaces || isSearching}>
          <LocateFixed size={15}/>
          {isLocating ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}
        </button>
      </div>

      <section className="account-panel map-search-panel">
        <form className="map-search-form" onSubmit={event => void searchLocation(event)}>
          <label className="sr-only" htmlFor="map-location-search">Ciudad, barrio o dirección</label>
          <div className="map-search-input">
            <Search size={17}/>
            <input id="map-location-search" value={searchText} maxLength={160} onChange={event => setSearchText(event.target.value)} placeholder="Busca una ciudad, barrio o dirección" autoComplete="off"/>
          </div>
          <button className="account-button outline" type="submit" disabled={!searchText.trim() || isSearching || isLoadingPlaces}>
            <Search size={15}/>{isSearching ? 'Buscando…' : 'Buscar ubicación'}
          </button>
        </form>

        {locationResults.length > 0 && (
          <div className="map-location-results" aria-label="Resultados de ubicación">
            {locationResults.map(result => (
              <button
                key={result.id}
                className="map-location-result"
                onClick={() => {
                  setLocationResults([]);
                  setSearchText(result.label);
                  void searchNearby({ lat: result.lat, lon: result.lon, label: result.label });
                }}
              >
                <MapPin size={16}/>
                <span><strong>{result.label}</strong>{result.detail && <small>{result.detail}</small>}</span>
              </button>
            ))}
          </div>
        )}
        {searchMessage && <p className="map-status" role="status">{searchMessage}</p>}
        {error && <p className="map-error" role="alert">{error}</p>}
      </section>

      <div className="workspace-map-layout">
        <section className="account-panel workspace-map-card">
          <div className="workspace-map-toolbar">
            <span>{center ? `Zona: ${center.label}` : 'Elige una ubicación para comenzar'}</span>
            <button className="account-button outline tiny" onClick={searchThisArea} disabled={!center || isLoadingPlaces}>
              <RefreshCw size={13}/>{isLoadingPlaces ? 'Buscando…' : 'Buscar en esta zona'}
            </button>
          </div>
          <div className="workspace-map-viewport">
            <div className="workspace-map-canvas" ref={mapElement} aria-label="Mapa de lugares cercanos"/>
            {tileError && <div className="map-tile-error" role="status">No se pudo cargar parte del mapa.<button onClick={retryMapTiles}>Reintentar</button></div>}
          </div>
          <p className="workspace-map-attribution">
            Mapa &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · Búsqueda con <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">Photon</a>.
          </p>
        </section>

        <aside className="account-panel nearby-places-panel">
          <div className="account-kicker">Lugares cercanos</div>
          <h2 className="display">Encuentra cuidado local</h2>
          <p className="subtle">
            {center
              ? `Resultados ordenados por distancia desde ${center.label}.`
              : 'Permite la ubicación del dispositivo o busca una dirección.'}
          </p>
          <p className="map-data-note">
            Mostramos lugares registrados en OpenStreetMap. Los espacios para eventos no son una agenda de eventos actuales.
          </p>
          <label className="account-field map-category-filter">
            <span>Filtrar por tipo</span>
            <select className="field" value={filter} onChange={event => setFilter(event.target.value as (typeof categories)[number])}>
              {categories.map(category => <option key={category}>{category}</option>)}
            </select>
          </label>

          {isLoadingPlaces ? (
            <div className="map-empty-state" role="status">Buscando lugares cercanos…</div>
          ) : visiblePlaces.length ? (
            <div className="nearby-place-list">
              {visiblePlaces.map(place => (
                <article className="nearby-place" key={place.id}>
                  <span className="nearby-place-icon"><MapPin size={17}/></span>
                  <div className="nearby-place-info">
                    <strong>{place.name}</strong>
                    <span>{place.category} · {place.distanceKm.toFixed(1)} km</span>
                    {place.address && <small>{place.address}</small>}
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`} target="_blank" rel="noreferrer">
                      Cómo llegar <ExternalLink size={12}/>
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="map-empty-state">
              <Navigation size={23}/>
              <strong>{center ? 'No hay resultados para este filtro' : 'La búsqueda empieza contigo'}</strong>
              <span>
                {center
                  ? 'Prueba otro tipo de lugar o busca otra zona.'
                  : 'La ubicación se solicita solo cuando pulsas “Usar mi ubicación”.'}
              </span>
            </div>
          )}
        </aside>
      </div>

      <p className="map-privacy-note">
        Medellín, Antioquia es la zona inicial. Tu ubicación no se guarda en PetPulse ni se usa para rastrear a tu mascota. Cuando buscas, las coordenadas se envían a Photon para consultar lugares cercanos; el mapa usa teselas de OpenStreetMap. También puedes buscar otra zona manualmente.
      </p>
    </main>
  );
}
