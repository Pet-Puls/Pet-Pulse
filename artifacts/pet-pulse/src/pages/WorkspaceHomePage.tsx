import {
  Activity, ArrowRight, Building2, PawPrint, Plus, ShieldCheck, Users,
} from 'lucide-react';
import { Link } from 'wouter';
import {
  getGetAdminOverviewQueryKey, getGetProviderProfileQueryKey, getListPetsQueryKey,
  useGetAdminOverview, useGetProviderProfile, useListPets,
} from '@workspace/api-client-react';
import type { MeProfile, PetProfile } from '@workspace/api-client-react';
import { ActionLink, ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';

export default function WorkspaceHomePage({ me }: { me: MeProfile }) {
  const pets = useListPets({ query: { enabled: me.role === 'owner', queryKey: getListPetsQueryKey() } });
  const overview = useGetAdminOverview({ query: { enabled: me.role === 'admin', queryKey: getGetAdminOverviewQueryKey() } });
  const greeting = me.role === 'owner' ? 'Su bienestar, a tu ritmo.' : me.role === 'provider' ? 'Tu negocio, más cerca.' : 'Una comunidad que responde.';
  const subtitle = me.role === 'owner' ? 'Aquí empieza el espacio privado de las mascotas que forman parte de tu vida.' : me.role === 'provider' ? 'Mantén al día tu perfil y comparte con claridad lo que ofreces.' : 'Revisa la actividad de PetPulse y los perfiles que esperan validación.';

  return <main className="account-content">
    <PageHeading kicker={`Hola, ${me.displayName}`} title={greeting} subtitle={subtitle}/>
    {me.role === 'owner' && <>
      {pets.isLoading ? <div className="account-grid two"><LoadingPanel label="Cargando mascotas…"/><LoadingPanel label="Actualizando tu espacio…"/></div>
        : pets.isError ? <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>
          : <div className="account-grid two">
            <section className="account-panel account-stat"><div className="account-stat-label">Mascotas en tu perfil <span className="pet-mark"><PawPrint size={18}/></span></div><div className="account-stat-value">{pets.data?.length ?? 0}</div><div className="account-stat-note">Perfiles privados de tu cuenta</div></section>
            <section className="account-panel" style={{ background: '#e9eddf' }}><div className="account-kicker">Un espacio propio</div><h2 className="display" style={{ color: '#285247', marginTop: 9 }}>Lo importante, siempre a mano.</h2><p className="subtle">Añade los detalles esenciales de cada mascota en un perfil seguro y persistente.</p><ActionLink href="/workspace/pets">Gestionar mascotas <ArrowRight size={14}/></ActionLink></section>
          </div>}
      <div className="section-row"><h2 className="display">Tus perfiles</h2><Link href="/workspace/pets" className="text-link">Administrar <ArrowRight size={13}/></Link></div>
      {pets.data?.length ? <div className="account-grid two">{pets.data.slice(0, 4).map(pet => <PetSummary key={pet.id} pet={pet}/>)}</div> : !pets.isLoading && !pets.isError ? <div className="account-panel empty-box"><PawPrint size={28}/><h3>Aún no hay perfiles</h3><p>Crea un perfil para tener los datos importantes de su cuidado en un único lugar.</p><ActionLink href="/workspace/pets">Añadir mascota <Plus size={14}/></ActionLink></div> : null}
    </>}
    {me.role === 'provider' && <ProviderWorkspaceIntro me={me}/>}
    {me.role === 'admin' && (overview.isLoading ? <LoadingPanel label="Actualizando las métricas…"/> : overview.isError ? <ErrorPanel message={errorMessage(overview.error)} retry={() => void overview.refetch()}/> :
      <div className="account-grid four">{[
        ['Cuentas', overview.data?.accounts ?? 0, Users], ['Mascotas', overview.data?.pets ?? 0, PawPrint],
        ['Perfiles de proveedor', overview.data?.providerProfiles ?? 0, Building2], ['Pendientes', overview.data?.pendingProviders ?? 0, Activity],
      ].map(([label, value, Icon]) => { const I = Icon as typeof Users; return <section key={String(label)} className="account-panel account-stat"><div className="account-stat-label">{String(label)} <span className="pet-mark" style={{ width: 32, height: 32 }}><I size={16}/></span></div><div className="account-stat-value">{String(value)}</div><div className="account-stat-note">Datos confirmados por el servidor</div></section>; })}</div>)}
    {me.role === 'admin' && <section className="account-panel" style={{ marginTop: 16, background: '#e9eddf' }}><div className="account-kicker">Revisión de comunidad</div><h2 className="display" style={{ color: '#285247', margin: '8px 0' }}>Perfiles de proveedor</h2><p className="subtle">Revisa solicitudes y administra su estado desde el panel protegido.</p><ActionLink href="/workspace/admin">Abrir administración <ArrowRight size={14}/></ActionLink></section>}
  </main>;
}

export function PetSummary({ pet }: { pet: PetProfile }) {
  return <article className="account-panel pet-row"><span className="pet-mark"><PawPrint size={23}/></span><div className="pet-description"><h3>{pet.name}</h3><p>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p></div><span className={`pet-status ${pet.status}`}>{pet.status === 'home' ? 'En casa' : pet.status === 'walking' ? 'De paseo' : 'Perdida'}</span></article>;
}

function ProviderWorkspaceIntro({ me }: { me: MeProfile }) {
  const profile = useGetProviderProfile({ query: { queryKey: getGetProviderProfileQueryKey() } });
  if (profile.isLoading) return <LoadingPanel label="Cargando perfil comercial…"/>;
  if (profile.isError) return <ErrorPanel message={errorMessage(profile.error)} retry={() => void profile.refetch()}/>;
  const status = profile.data?.approvalStatus || me.providerStatus;

  return <div className="account-grid two"><section className="account-panel"><div className="account-kicker">Estado del perfil</div><h2 className="display" style={{ color: '#285247', margin: '10px 0 14px' }}>{profile.data?.name || 'Tu negocio está por presentarse'}</h2><span className={`provider-status ${status}`}>{status === 'approved' ? 'Aprobado' : status === 'suspended' ? 'Suspendido' : 'Pendiente de revisión'}</span><p className="subtle" style={{ marginTop: 15 }}>{profile.data ? `${profile.data.category} · ${profile.data.neighborhood}` : 'Completa la información comercial para enviar tu perfil a revisión.'}</p><ActionLink href="/workspace/provider">{profile.data ? 'Editar perfil' : 'Completar perfil'} <ArrowRight size={14}/></ActionLink></section><section className="account-panel" style={{ background: '#f0e6d0' }}><ShieldCheck size={23}/><h2 className="display" style={{ color: '#285247', margin: '12px 0 8px' }}>Tu perfil, con transparencia.</h2><p className="subtle">El estado de revisión se asigna desde administración. No puedes aprobar ni cambiar por tu cuenta el estado de tu perfil.</p></section></div>;
}
