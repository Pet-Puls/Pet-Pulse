import { useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, MapPin, Search, Store } from 'lucide-react';
import { Link } from 'wouter';
import type { ListPublicProvidersCategory } from '@workspace/api-client-react';
import { useListPublicProvidersValidated } from '@workspace/api-client-react/public-providers';
import { Brand, ErrorPanel, LoadingPanel, errorMessage } from '@/components/app-shared';
import { getProviderCategoryLabel, providerCategories } from '@/features/providers';

const pageSize = 12;

export default function DirectoryPage() {
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ListPublicProvidersCategory | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchText.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const providers = useListPublicProvidersValidated({
    q: query || undefined,
    category: category || undefined,
    page,
    pageSize,
  });
  const totalPages = Math.max(1, Math.ceil((providers.data?.total ?? 0) / pageSize));

  return <div className="public-shell">
    <header className="public-nav">
      <Brand/>
      <nav className="public-nav-actions" aria-label="Navegación">
        <Link className="public-link" href="/">Inicio</Link>
        <Link className="public-link" href="/map">Mapa cercano</Link>
        <Link className="account-button" href="/sign-in">Iniciar sesión</Link>
      </nav>
    </header>
    <main className="directory-page">
      <div className="directory-heading">
        <div className="public-kicker">Una comunidad que cuida</div>
        <h1 className="display">Proveedores de confianza, cerca de ti.</h1>
        <p>Explora negocios locales revisados por PetPulse. Las ubicaciones y enlaces externos son información del proveedor; confirma los datos antes de desplazarte.</p>
      </div>

      <section className="directory-filters" aria-label="Buscar proveedores">
        <label className="directory-search">
          <Search size={18} aria-hidden="true"/>
          <span className="sr-only">Buscar por negocio o barrio</span>
          <input
            type="search"
            value={searchText}
            maxLength={120}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Nombre del negocio o barrio"
          />
        </label>
        <label className="directory-category">
          <span className="sr-only">Filtrar por categoría</span>
          <select value={category} onChange={event => {
            setCategory(event.target.value as ListPublicProvidersCategory | '');
            setPage(1);
          }}>
            <option value="">Todas las categorías</option>
            {providerCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </section>

      {providers.isLoading ? <div className="directory-loading"><LoadingPanel label="Buscando proveedores aprobados…"/></div>
        : providers.isError ? <ErrorPanel message={errorMessage(providers.error)} retry={() => void providers.refetch()}/>
          : providers.data?.items.length ? <>
            <p className="directory-result-count" role="status">
              {providers.data.total} {providers.data.total === 1 ? 'proveedor aprobado' : 'proveedores aprobados'}
            </p>
            <div className="directory-grid">
              {providers.data.items.map(provider => (
                <article className="directory-card" key={provider.id}>
                  <div className="directory-card-top">
                    <span className="directory-icon"><Store size={20}/></span>
                    <span className="directory-approved"><BadgeCheck size={15}/> Revisado</span>
                  </div>
                  <div className="account-kicker">{getProviderCategoryLabel(provider.category)}</div>
                  <h2>{provider.name}</h2>
                  <p className="directory-neighborhood"><MapPin size={15}/>{provider.neighborhood}</p>
                  {provider.description && <p className="directory-description">{provider.description}</p>}
                  <div className="directory-provider-links" aria-label={`Enlaces de ${provider.name}`}>
                    {([
                      ['websiteUrl', 'Sitio web', provider.websiteUrl],
                      ['instagramUrl', 'Instagram', provider.instagramUrl],
                      ['facebookUrl', 'Facebook', provider.facebookUrl],
                      ['whatsappUrl', 'WhatsApp', provider.whatsappUrl],
                    ] as const).flatMap(([field, label, href]) => href ? [
                      <a key={field} href={href} target="_blank" rel="noopener noreferrer">
                        {label}<ExternalLink size={13} aria-hidden="true"/>
                      </a>,
                    ] : [])}
                  </div>
                  <a
                    className="account-button outline"
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${provider.name}, ${provider.neighborhood}`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Buscar en Google Maps <MapPin size={15}/>
                  </a>
                </article>
              ))}
            </div>
            {totalPages > 1 && <nav className="directory-pagination" aria-label="Paginación del directorio">
              <button className="account-button outline" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1}>
                Anterior
              </button>
              <span aria-live="polite">Página {page} de {totalPages}</span>
              <button className="account-button outline" onClick={() => setPage(current => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                Siguiente
              </button>
            </nav>}
          </> : <section className="directory-empty">
            <Store size={28}/>
            <h2>{query || category ? 'No encontramos resultados' : 'Todavía no hay perfiles aprobados'}</h2>
            <p>{query || category
              ? 'Prueba con otro nombre, barrio o categoría.'
              : 'Los negocios aparecerán aquí cuando completen el proceso de revisión.'}</p>
          </section>}
    </main>
    <footer className="public-footer"><Brand/><span>PetPulse · cuidado cercano, comunidad real</span></footer>
  </div>;
}
