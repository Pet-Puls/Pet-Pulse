import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  QueryClient, QueryClientProvider, useQueryClient,
} from '@tanstack/react-query';
import {
  Activity, ArrowRight, BadgeCheck, Building2, Check, ChevronRight, CircleHelp,
  ClipboardList, Heart, Home, LogOut, MapPin, PawPrint, Plus, RefreshCw,
  ShieldCheck, Store, Trash2, UserRound, Users, X,
} from 'lucide-react';
import {
  getGetAdminOverviewQueryKey, getGetMeQueryKey, getGetProviderProfileQueryKey,
  getListAdminProvidersQueryKey, getListPetsQueryKey, useCompleteOnboarding,
  useCreatePet, useDeletePet, useGetAdminOverview, useGetMe,
  useGetProviderProfile, useListAdminProviders, useListPets,
  useSaveProviderProfile, useUpdatePet, useUpdateProviderApproval,
  setAuthTokenGetter, setBaseUrl,
} from '@workspace/api-client-react';
import type {
  MeProfile, PetInput, PetProfile, ProviderProfile, ProviderProfileInput,
} from '@workspace/api-client-react';
import { Route, Switch, Router as WouterRouter, Link, Redirect, useLocation } from 'wouter';
import { DemoApp } from './DemoApp';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import '@/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 } },
});
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || null;
setBaseUrl(apiBaseUrl);
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const ApiAuthReadyContext = createContext(!apiBaseUrl);
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
if (import.meta.env.PROD && !apiBaseUrl) {
  throw new Error(
    'Missing VITE_API_BASE_URL: define la URL de la API (Render) en las variables de Vercel y vuelve a desplegar.',
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#286354',
    colorForeground: '#294b42',
    colorMutedForeground: '#718078',
    colorDanger: '#ae5549',
    colorBackground: '#fffdf7',
    colorInput: '#fffefa',
    colorInputForeground: '#294b42',
    colorNeutral: '#dfe3d8',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#244d43] font-bold',
    headerSubtitle: 'text-[#718078]',
    socialButtonsBlockButtonText: 'text-[#31594d] font-semibold',
    formFieldLabel: 'text-[#47695b] font-semibold',
    footerActionLink: 'text-[#286354] font-semibold',
    footerActionText: 'text-[#718078]',
    dividerText: 'text-[#829087]',
    identityPreviewEditButton: 'text-[#286354]',
    formFieldSuccessText: 'text-[#477855]',
    alertText: 'text-[#9c4d42]',
    logoBox: 'rounded-lg overflow-hidden',
    logoImage: 'h-9 w-9',
    socialButtonsBlockButton: 'border-[#dfe3d8] bg-[#fffefa] rounded-xl',
    formButtonPrimary: 'bg-[#286354] hover:bg-[#1d4f44] rounded-xl',
    formFieldInput: 'border-[#dfe3d8] bg-[#fffefa] rounded-xl',
    footerAction: 'border-t border-[#ece9df]',
    dividerLine: 'bg-[#e4e4d9]',
    alert: 'bg-[#fae8e1] border-[#f0cfc5]',
    otpCodeFieldInput: 'border-[#dfe3d8] bg-[#fffefa] rounded-lg',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};
const clerkLocalization = {
  signIn: { start: { title: 'Qué gusto verte', subtitle: 'Entra a tu espacio PetPulse' } },
  signUp: { start: { title: 'Cuidemos en comunidad', subtitle: 'Crea tu cuenta PetPulse' } },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== userId) client.clear();
      previous.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}
function ApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [ready, setReady] = useState(!apiBaseUrl);
  useEffect(() => {
    if (!apiBaseUrl) {
      setAuthTokenGetter(null);
      setReady(true);
      return;
    }
    setReady(false);
    if (!isLoaded) {
      setAuthTokenGetter(null);
      return;
    }
    setAuthTokenGetter(() => getToken());
    setReady(true);
    return () => {
      setAuthTokenGetter(null);
      setReady(false);
    };
  }, [getToken, isLoaded]);
  return <ApiAuthReadyContext.Provider value={!apiBaseUrl || ready}>{children}</ApiAuthReadyContext.Provider>;
}
function useApiAuthReady() {
  return useContext(ApiAuthReadyContext);
}
function Brand({ className = '' }: { className?: string }) {
  return <Link href="/" className={`public-brand ${className}`}><img src={`${basePath}/logo.svg`} alt="" />petpulse</Link>;
}

function ActionLink({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return <Link href={href} className={`account-button ${light ? 'light' : ''}`}>{children}</Link>;
}

function PublicHome() {
  const { isLoaded, isSignedIn } = useAuth();
  const apiAuthReady = useApiAuthReady();
  const me = useGetMe({ query: { enabled: isLoaded && isSignedIn === true && apiAuthReady, queryKey: getGetMeQueryKey(), retry: false } });
  if (isLoaded && isSignedIn && apiAuthReady && me.data) return <Redirect to={me.data.onboardingCompleted ? '/workspace' : '/onboarding'} />;
  return <div className="public-shell">
    <header className="public-nav"><Brand /><nav className="public-nav-actions" aria-label="Acceso">
      {isLoaded && isSignedIn ? <ActionLink href="/workspace">Ir a mi espacio <ArrowRight size={15}/></ActionLink> : <>
        <Link className="public-link" href="/sign-in">Iniciar sesión</Link>
        <ActionLink href="/sign-up">Crear cuenta <ArrowRight size={15}/></ActionLink>
      </>}
    </nav></header>
    <main>
      <section className="public-hero">
        <div className="public-copy">
          <span className="public-kicker">Una comunidad que cuida</span>
          <h1>Su vida diaria,<br/>más <em>cerca.</em></h1>
          <p>PetPulse reúne el cuidado de tu mascota y a las personas de confianza de tu barrio. Todo lo importante, en un espacio claro y solo tuyo.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ActionLink href="/sign-up">Empieza con PetPulse <ArrowRight size={16}/></ActionLink>
            <ActionLink href="/demo" light>Explorar la demostración</ActionLink>
          </div>
        </div>
        <div className="public-art" aria-label="Ilustración de una huella rodeada por círculos de comunidad">
          <div className="orbit"><div className="orbit-center"><PawPrint /></div>
            <span className="orbit-label one">Cuidado de confianza</span>
            <span className="orbit-label two">Su día, a tu manera</span>
            <span className="orbit-label three">Tu comunidad local</span>
          </div>
        </div>
      </section>
      <section className="public-proof" aria-label="Principios PetPulse">
        <div className="proof-intro">Un lugar pensado para quienes forman parte de su cuidado.</div>
        <div className="proof-item"><strong>Tu información, privada</strong>Los perfiles reales viven en tu cuenta.</div>
        <div className="proof-item"><strong>Roles con propósito</strong>Espacios distintos para tutores y proveedores.</div>
        <div className="proof-item"><strong>Una red cercana</strong>Conoce a los servicios locales con claridad.</div>
      </section>
      <section className="public-section">
        <div className="public-section-head"><span className="public-kicker">Cuidar puede ser más sencillo</span><h2>Menos vueltas.<br/>Más momentos juntos.</h2></div>
        <div className="care-grid">
          <article className="care-feature"><div><span className="public-kicker" style={{ color: '#e9c67f' }}>Para tutores</span><h3>Todo sobre ellos, en un sitio que se siente propio.</h3></div><div><p>Guarda sus perfiles y datos importantes con acceso privado. Tu cuenta te acompaña, sin mezclar nada con la demostración.</p><ActionLink href="/sign-up" light>Crear mi cuenta <ArrowRight size={14}/></ActionLink></div></article>
          <div className="care-aside">
            <article className="care-tile"><div><Heart size={21}/><h3>Una comunidad más cercana</h3></div><p>Encuentra profesionales locales que forman parte del día a día de las mascotas.</p></article>
            <article className="care-tile"><div><ShieldCheck size={21}/><h3>Claridad en cada paso</h3></div><p>Perfiles de proveedor con revisión y estados visibles para una experiencia confiable.</p></article>
          </div>
        </div>
      </section>
    </main>
    <footer className="public-footer"><Brand/><span>PetPulse · cuidado cercano, comunidad real</span><Link className="public-link" href="/demo">Ver demostración</Link></footer>
  </div>;
}

function LoadingPanel({ label = 'Cargando tu espacio…' }: { label?: string }) {
  return <div className="account-panel" role="status" aria-live="polite"><p className="account-kicker">{label}</p><div className="loading-line"/><div className="loading-line" style={{ width: '72%' }}/><div className="loading-line" style={{ width: '46%' }}/></div>;
}
function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-box" role="alert"><span>{message}</span><button className="account-button tiny" onClick={retry}><RefreshCw size={13}/> Reintentar</button></div>;
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.';
}
function PageHeading({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="account-heading"><div><div className="account-kicker">{kicker}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}
function AccountFrame({ me, children }: { me: MeProfile; children: ReactNode }) {
  const [path] = useLocation();
  const { signOut } = useClerk();
  const nav = [
    { href: '/workspace', label: 'Resumen', icon: Home },
    ...(me.role === 'owner' ? [{ href: '/workspace/pets', label: 'Mis mascotas', icon: PawPrint }] : []),
    ...(me.role === 'provider' ? [{ href: '/workspace/provider', label: 'Mi perfil comercial', icon: Store }] : []),
    ...(me.role === 'admin' ? [{ href: '/workspace/admin', label: 'Administración', icon: ShieldCheck }] : []),
  ];
  const initials = me.displayName.split(/\s+/).slice(0, 2).map(n => n[0]?.toUpperCase() || '').join('') || 'PP';
  return <div className="account-layout">
    <aside className="account-side"><Brand/><div className="account-nav-label">Tu espacio</div><nav className="account-nav" aria-label="Navegación de cuenta">{nav.map(item => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={path === item.href ? 'active' : ''}><Icon size={17}/>{item.label}</Link>; })}</nav><div className="account-side-foot"><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7 }}><ShieldCheck size={15}/> Cuenta protegida</div>Tu información permanece asociada a tu cuenta.</div></aside>
    <div className="account-main"><header className="account-topbar"><span>PetPulse <ChevronRight size={13} style={{ verticalAlign: 'middle', margin: '0 5px' }}/><strong style={{ color: '#365f50' }}>{me.role === 'owner' ? 'Espacio tutor' : me.role === 'provider' ? 'Espacio proveedor' : 'Administración'}</strong></span><div className="account-top-actions"><span>{me.displayName}</span><div className="account-avatar" aria-label={`Perfil de ${me.displayName}`}>{initials}</div><button className="account-button outline tiny" onClick={() => void signOut({ redirectUrl: basePath || '/' })}><LogOut size={14}/> Salir</button></div></header>{children}</div>
  </div>;
}

function PrivateRoute({ children, role }: { children: (me: MeProfile) => ReactNode; role?: MeProfile['role'] }) {
  const { isLoaded, isSignedIn } = useAuth();
  const apiAuthReady = useApiAuthReady();
  const me = useGetMe({ query: { enabled: isLoaded && isSignedIn === true && apiAuthReady, queryKey: getGetMeQueryKey(), retry: false } });
  if (!isLoaded) return <main className="account-content"><LoadingPanel label="Comprobando sesión…"/></main>;
  if (!isSignedIn) return <Redirect to="/" />;
  if (!apiAuthReady) return <main className="account-content"><LoadingPanel label="Preparando conexión segura…"/></main>;
  if (me.isLoading) return <main className="account-content"><LoadingPanel/></main>;
  if (me.isError) return <main className="account-content"><ErrorPanel message={errorMessage(me.error)} retry={() => void me.refetch()}/></main>;
  if (!me.data) return <main className="account-content"><LoadingPanel/></main>;
  if (!me.data.onboardingCompleted) return <Redirect to="/onboarding"/>;
  if (role && me.data.role !== role) return <Redirect to="/workspace"/>;
  return <AccountFrame me={me.data}>{children(me.data)}</AccountFrame>;
}

function OnboardingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const apiAuthReady = useApiAuthReady();
  const me = useGetMe({ query: { enabled: isLoaded && isSignedIn === true && apiAuthReady, queryKey: getGetMeQueryKey(), retry: false } });
  const [role, setRole] = useState<'owner' | 'provider'>('owner');
  const [displayName, setDisplayName] = useState('');
  const client = useQueryClient();
  const complete = useCompleteOnboarding({ mutation: { onSuccess: profile => {
    client.setQueryData(getGetMeQueryKey(), profile);
    void client.invalidateQueries({ queryKey: getGetMeQueryKey() });
  } } });
  if (!isLoaded) return <div className="onboarding-wrap"><LoadingPanel label="Cargando…"/></div>;
  if (!isSignedIn) return <Redirect to="/"/>;
  if (!apiAuthReady) return <div className="onboarding-wrap"><LoadingPanel label="Preparando conexión segura…"/></div>;
  if (me.isLoading) return <div className="onboarding-wrap"><LoadingPanel/></div>;
  if (me.isError) return <div className="onboarding-wrap"><div style={{ width: 'min(680px,100%)' }}><ErrorPanel message={errorMessage(me.error)} retry={() => void me.refetch()}/></div></div>;
  if (me.data?.onboardingCompleted) return <Redirect to="/workspace"/>;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!displayName.trim()) return;
    complete.mutate({ data: { displayName: displayName.trim(), requestedRole: role } });
  };
  return <div className="onboarding-wrap"><section className="onboarding-card">
    <Brand/><div style={{ marginTop: 36 }} className="account-kicker">Tu primer paso</div>
    <h1 className="display" style={{ fontSize: 'clamp(33px,5vw,48px)', color: '#244d43', margin: '12px 0' }}>¿Cómo participas en su cuidado?</h1>
    <p className="subtle">Personaliza tu espacio. Esta elección se completa una sola vez y determina las herramientas de tu cuenta.</p>
    <form onSubmit={submit}>
      <div className="account-field" style={{ marginTop: 22 }}><label htmlFor="display-name">Tu nombre</label><input id="display-name" value={displayName} maxLength={120} required onChange={e => setDisplayName(e.target.value)} placeholder="Cómo te llamamos" autoComplete="name"/></div>
      <div className="role-choice-grid">
        <button type="button" className={`role-choice ${role === 'owner' ? 'selected' : ''}`} aria-pressed={role === 'owner'} onClick={() => setRole('owner')}><PawPrint size={22}/><h3>Soy persona tutora</h3><p>Quiero organizar la información y el cuidado de mis mascotas.</p></button>
        <button type="button" className={`role-choice ${role === 'provider' ? 'selected' : ''}`} aria-pressed={role === 'provider'} onClick={() => setRole('provider')}><Store size={22}/><h3>Ofrezco servicios</h3><p>Quiero presentar mi negocio local a la comunidad.</p></button>
      </div>
      {complete.isError && <div className="error-box" role="alert" style={{ marginBottom: 14 }}>{errorMessage(complete.error)}</div>}
      <button className="account-button" type="submit" disabled={!displayName.trim() || complete.isPending}>{complete.isPending ? 'Guardando tu espacio…' : 'Continuar'} <ArrowRight size={15}/></button>
    </form>
  </section></div>;
}

function WorkspaceHome({ me }: { me: MeProfile }) {
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
function PetSummary({ pet }: { pet: PetProfile }) {
  return <article className="account-panel pet-row"><span className="pet-mark"><PawPrint size={23}/></span><div className="pet-description"><h3>{pet.name}</h3><p>{pet.species}{pet.breed ? ` · ${pet.breed}` : ''}</p></div><span className={`pet-status ${pet.status}`}>{pet.status === 'home' ? 'En casa' : pet.status === 'walking' ? 'De paseo' : 'Perdida'}</span></article>;
}

function ProviderWorkspaceIntro({ me }: { me: MeProfile }) {
  const profile = useGetProviderProfile({ query: { queryKey: getGetProviderProfileQueryKey() } });
  if (profile.isLoading) return <LoadingPanel label="Cargando perfil comercial…"/>;
  if (profile.isError) return <ErrorPanel message={errorMessage(profile.error)} retry={() => void profile.refetch()}/>;
  const status = profile.data?.approvalStatus || me.providerStatus;
  return <div className="account-grid two"><section className="account-panel"><div className="account-kicker">Estado del perfil</div><h2 className="display" style={{ color: '#285247', margin: '10px 0 14px' }}>{profile.data?.name || 'Tu negocio está por presentarse'}</h2><span className={`provider-status ${status}`}>{status === 'approved' ? 'Aprobado' : status === 'suspended' ? 'Suspendido' : 'Pendiente de revisión'}</span><p className="subtle" style={{ marginTop: 15 }}>{profile.data ? `${profile.data.category} · ${profile.data.neighborhood}` : 'Completa la información comercial para enviar tu perfil a revisión.'}</p><ActionLink href="/workspace/provider">{profile.data ? 'Editar perfil' : 'Completar perfil'} <ArrowRight size={14}/></ActionLink></section><section className="account-panel" style={{ background: '#f0e6d0' }}><ShieldCheck size={23}/><h2 className="display" style={{ color: '#285247', margin: '12px 0 8px' }}>Tu perfil, con transparencia.</h2><p className="subtle">El estado de revisión se asigna desde administración. No puedes aprobar ni cambiar por tu cuenta el estado de tu perfil.</p></section></div>;
}

function PetEditor({ pet, onClose, onSaved }: { pet?: PetProfile; onClose: () => void; onSaved: (input: PetInput) => void }) {
  const [name, setName] = useState(pet?.name || '');
  const [species, setSpecies] = useState(pet?.species || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [age, setAge] = useState(pet?.age || '');
  const [contact, setContact] = useState(pet?.emergencyContact || '');
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pet-editor-title"><div className="modal-head"><div><div className="eyebrow">PetPulse · perfil privado</div><h2 className="display" id="pet-editor-title">{pet ? `Editar a ${pet.name}` : 'Nueva mascota'}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={onClose}><X size={17}/></button></div>
    <form className="account-form" onSubmit={e => { e.preventDefault(); onSaved({ name: name.trim(), species: species.trim(), breed: breed.trim() || null, age: age.trim() || null, emergencyContact: contact.trim() || null }); }}>
      <div className="account-field"><label htmlFor="pet-name">Nombre</label><input id="pet-name" value={name} required maxLength={100} onChange={e => setName(e.target.value)} autoFocus/></div>
      <div className="account-field"><label htmlFor="pet-species">Especie</label><input id="pet-species" value={species} required maxLength={60} onChange={e => setSpecies(e.target.value)} placeholder="Perro, gato…"/></div>
      <div className="account-field"><label htmlFor="pet-breed">Raza (opcional)</label><input id="pet-breed" value={breed} maxLength={120} onChange={e => setBreed(e.target.value)}/></div>
      <div className="account-field"><label htmlFor="pet-age">Edad (opcional)</label><input id="pet-age" value={age} maxLength={80} onChange={e => setAge(e.target.value)} placeholder="Ej. 4 años"/></div>
      <div className="account-field full"><label htmlFor="pet-emergency">Contacto de emergencia (opcional)</label><input id="pet-emergency" value={contact} maxLength={240} onChange={e => setContact(e.target.value)} placeholder="Teléfono y nombre"/></div>
      <div className="account-form-actions"><button type="button" className="account-button outline" onClick={onClose}>Cancelar</button><button className="account-button" type="submit">Guardar perfil <Check size={15}/></button></div>
    </form>
  </section></div>;
}
function PetsPage() {
  const client = useQueryClient();
  const pets = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createPet = useCreatePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const updatePet = useUpdatePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const deletePet = useDeletePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const [editing, setEditing] = useState<PetProfile | null | 'new'>(null);
  const [failure, setFailure] = useState('');
  const saving = createPet.isPending || updatePet.isPending;
  const save = (input: PetInput) => {
    setFailure('');
    if (editing && editing !== 'new') updatePet.mutate({ petId: editing.id, data: input }, { onSuccess: () => setEditing(null), onError: e => setFailure(errorMessage(e)) });
    else createPet.mutate({ data: input }, { onSuccess: () => setEditing(null), onError: e => setFailure(errorMessage(e)) });
  };
  return <main className="account-content"><PageHeading kicker="Su identidad, siempre a mano" title="Mis mascotas" subtitle="Perfiles privados y persistentes para guardar lo esencial de su cuidado." action={<button className="account-button" onClick={() => setEditing('new')}><Plus size={15}/> Añadir mascota</button>}/>
    {failure && <div style={{ marginBottom: 14 }}><ErrorPanel message={failure} retry={() => setFailure('')}/></div>}
    {(pets.isLoading || saving || deletePet.isPending) && <LoadingPanel label={saving ? 'Guardando cambios…' : deletePet.isPending ? 'Eliminando perfil…' : 'Cargando perfiles…'}/>}
    {pets.isError && <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>}
    {pets.data?.length ? <div className="account-grid two">{pets.data.map(pet => <article key={pet.id} className="account-panel">
      <PetSummary pet={pet}/><div style={{ display: 'flex', gap: 8, marginTop: 18, borderTop: '1px solid #efede3', paddingTop: 14 }}>
        <button className="account-button outline tiny" onClick={() => setEditing(pet)}><UserRound size={13}/> Editar</button>
        <label className="account-field" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}><span className="sr-only">Estado de {pet.name}</span><select aria-label={`Estado de ${pet.name}`} value={pet.status} onChange={e => updatePet.mutate({ petId: pet.id, data: { status: e.target.value as PetProfile['status'] } }, { onError: er => setFailure(errorMessage(er)) })} className="field" style={{ width: 'auto', padding: '7px 10px' }}><option value="home">En casa</option><option value="walking">De paseo</option><option value="lost">Perdida</option></select></label>
        <button className="account-button danger tiny" onClick={() => { if (window.confirm(`¿Eliminar el perfil de ${pet.name}? Esta acción no se puede deshacer.`)) deletePet.mutate({ petId: pet.id }, { onError: er => setFailure(errorMessage(er)) }); }} aria-label={`Eliminar a ${pet.name}`}><Trash2 size={13}/> Eliminar</button>
      </div>
    </article>)}</div> : null}
    {!pets.isLoading && !pets.isError && !pets.data?.length && <section className="account-panel empty-box"><PawPrint size={30}/><h3>Un perfil para cada historia</h3><p>Aún no has añadido mascotas. Empieza con la información que te gustaría tener siempre a mano.</p><button className="account-button" onClick={() => setEditing('new')}><Plus size={14}/> Crear primer perfil</button></section>}
    {editing && <PetEditor key={editing === 'new' ? 'new' : editing.id} pet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={save}/>}
  </main>;
}

const providerCategories = [
  ['veterinary', 'Veterinaria'], ['daycare', 'Guardería'], ['walker', 'Paseador/a'],
  ['shelter', 'Refugio'], ['store', 'Tienda'], ['other', 'Otro'],
];
function ProviderPage() {
  const client = useQueryClient();
  const profile = useGetProviderProfile({ query: { queryKey: getGetProviderProfileQueryKey() } });
  const saveProfile = useSaveProviderProfile({ mutation: { onSuccess: result => {
    client.setQueryData(getGetProviderProfileQueryKey(), result);
    void client.invalidateQueries({ queryKey: getGetProviderProfileQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMeQueryKey() });
  } } });
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProviderProfileInput['category']>('veterinary');
  const [neighborhood, setNeighborhood] = useState('');
  const [description, setDescription] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (profile.data && !initialized) {
      setName(profile.data.name); setCategory(profile.data.category);
      setNeighborhood(profile.data.neighborhood); setDescription(profile.data.description || '');
      setInitialized(true);
    }
  }, [profile.data, initialized]);
  const submit = (event: FormEvent) => {
    event.preventDefault(); setNotice('');
    saveProfile.mutate({ data: { name: name.trim(), category, neighborhood: neighborhood.trim(), description: description.trim() || null } }, {
      onSuccess: result => { setInitialized(true); setNotice('Tu perfil se guardó y está pendiente de revisión.'); },
    });
  };
  return <main className="account-content"><PageHeading kicker="Tu actividad local" title="Perfil de proveedor" subtitle="Presenta tu negocio con información clara para las personas de tu comunidad."/>
    {profile.isLoading && <LoadingPanel label="Cargando tu perfil comercial…"/>}
    {profile.isError && <ErrorPanel message={errorMessage(profile.error)} retry={() => void profile.refetch()}/>}
    {!profile.isLoading && !profile.isError && <div className="account-grid two">
      <section className="account-panel"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}><div className="account-kicker">Datos del negocio</div><span className={`provider-status ${profile.data?.approvalStatus || 'pending'}`}>{profile.data ? profile.data.approvalStatus === 'approved' ? 'Aprobado' : profile.data.approvalStatus === 'suspended' ? 'Suspendido' : 'Pendiente' : 'Sin enviar'}</span></div>
        {notice && <div className="notice-box" role="status" style={{ marginBottom: 15 }}><BadgeCheck size={17}/>{notice}</div>}
        {saveProfile.isError && <div className="error-box" role="alert" style={{ marginBottom: 14 }}>{errorMessage(saveProfile.error)}</div>}
        <form className="account-form" onSubmit={submit}>
          <div className="account-field full"><label htmlFor="business-name">Nombre comercial</label><input id="business-name" required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de tu negocio"/></div>
          <div className="account-field"><label htmlFor="business-category">Categoría</label><select id="business-category" value={category} onChange={e => setCategory(e.target.value as ProviderProfileInput['category'])}>{providerCategories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="account-field"><label htmlFor="business-neighborhood">Barrio o localidad</label><input id="business-neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} required maxLength={120} placeholder="Ej. Malasaña"/></div>
          <div className="account-field full"><label htmlFor="business-description">Descripción (opcional)</label><textarea id="business-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Cuéntanos brevemente qué servicios ofreces."/></div>
          <div className="account-form-actions"><button className="account-button" disabled={saveProfile.isPending}>{saveProfile.isPending ? 'Guardando…' : 'Guardar perfil'} <Check size={15}/></button></div>
        </form>
      </section>
      <aside className="account-panel" style={{ background: '#e9eddf', alignSelf: 'start' }}><ShieldCheck size={23}/><h2 className="display" style={{ color: '#285247', margin: '12px 0 8px' }}>Un proceso transparente.</h2><p className="subtle">Después de guardar, el equipo revisará el perfil. El estado cambia desde administración y no puede modificarse desde tu cuenta.</p><div className="notice-box"><CircleHelp size={16}/><span>{profile.data?.approvalStatus === 'approved' ? 'Tu perfil está aprobado y visible para la comunidad.' : profile.data?.approvalStatus === 'suspended' ? 'Tu perfil está suspendido. Contacta con el equipo de PetPulse si necesitas ayuda.' : 'Tu perfil se mostrará como pendiente hasta completar la revisión.'}</span></div></aside>
    </div>}
  </main>;
}

function AdminPage() {
  const client = useQueryClient();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const [filter, setFilter] = useState<'pending' | 'approved' | 'suspended'>('pending');
  const providers = useListAdminProviders({ status: filter }, { query: { queryKey: getListAdminProvidersQueryKey({ status: filter }) } });
  const updateApproval = useUpdateProviderApproval({ mutation: { onSuccess: () => {
    void client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    void client.invalidateQueries({ queryKey: getListAdminProvidersQueryKey() });
  } } });
  const setStatus = (profile: ProviderProfile, approvalStatus: 'approved' | 'suspended') => updateApproval.mutate({ providerId: profile.id, data: { approvalStatus } });
  return <main className="account-content"><PageHeading kicker="Acceso de administración" title="Revisión de proveedores" subtitle="Métricas y decisiones de estado autorizadas por el servidor."/>
    {overview.isLoading ? <div className="account-grid four"><LoadingPanel/><LoadingPanel/><LoadingPanel/><LoadingPanel/></div> : overview.isError ? <ErrorPanel message={errorMessage(overview.error)} retry={() => void overview.refetch()}/> : <div className="account-grid four">
      {[
        ['Cuentas', overview.data?.accounts ?? 0, Users],
        ['Mascotas', overview.data?.pets ?? 0, PawPrint],
        ['Perfiles', overview.data?.providerProfiles ?? 0, Building2],
        ['Pendientes', overview.data?.pendingProviders ?? 0, Activity],
      ].map(([label, value, Icon]) => { const I = Icon as typeof Users; return <section className="account-panel account-stat" key={String(label)}><div className="account-stat-label">{String(label)} <span className="pet-mark" style={{ width: 32, height: 32 }}><I size={16}/></span></div><div className="account-stat-value">{String(value)}</div><div className="account-stat-note">Cifras del servidor</div></section>; })}
    </div>}
    <section className="account-panel" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}><div><div className="account-kicker">Control de acceso</div><h2 className="display" style={{ margin: '7px 0 0', color: '#285247' }}>Perfiles comerciales</h2></div><label className="account-field"><span className="sr-only">Filtrar por estado</span><select aria-label="Filtrar perfiles por estado" className="field" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="pending">Pendientes</option><option value="approved">Aprobados</option><option value="suspended">Suspendidos</option></select></label></div>
      {updateApproval.isError && <div className="error-box" style={{ marginBottom: 12 }} role="alert">{errorMessage(updateApproval.error)}</div>}
      {providers.isLoading ? <LoadingPanel label="Cargando solicitudes…"/> : providers.isError ? <ErrorPanel message={errorMessage(providers.error)} retry={() => void providers.refetch()}/> :
        providers.data?.length ? providers.data.map(profile => <article key={profile.id} className="admin-row">
          <div><h3>{profile.name}</h3><p><MapPin size={12} style={{ verticalAlign: 'middle' }}/> {profile.neighborhood} · {providerCategories.find(([key]) => key === profile.category)?.[1] || profile.category}</p>{profile.description && <p>{profile.description}</p>}<span className={`provider-status ${profile.approvalStatus}`}>{profile.approvalStatus === 'approved' ? 'Aprobado' : profile.approvalStatus === 'suspended' ? 'Suspendido' : 'Pendiente'}</span></div>
          <div className="admin-actions">{filter !== 'approved' && <button className="account-button tiny" disabled={updateApproval.isPending} onClick={() => setStatus(profile, 'approved')}><Check size={13}/> Aprobar</button>}{filter !== 'suspended' && <button className="account-button danger tiny" disabled={updateApproval.isPending} onClick={() => setStatus(profile, 'suspended')}><X size={13}/> Suspender</button>}</div>
        </article>) : <div className="empty-box"><ClipboardList size={28}/><h3>No hay perfiles {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : 'suspendidos'}</h3><p>Cuando haya perfiles en este estado, aparecerán aquí.</p></div>}
    </section>
  </main>;
}

function SignInPage() {
  return <div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Un lugar más sencillo para cuidar de ellos.</div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>;
}
function SignUpPage() {
  return <div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Empieza a coordinar su cuidado con confianza.</div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>;
}
function RouterContent() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={clerkLocalization as never}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator/>
      <ApiAuthBridge><TooltipProvider><Switch>
        <Route path="/" component={PublicHome}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/demo/*?" component={DemoApp}/>
        <Route path="/onboarding" component={OnboardingPage}/>
        <Route path="/workspace"><PrivateRoute>{me => <WorkspaceHome me={me}/>}</PrivateRoute></Route>
        <Route path="/workspace/pets"><PrivateRoute role="owner">{() => <PetsPage/>}</PrivateRoute></Route>
        <Route path="/workspace/provider"><PrivateRoute role="provider">{() => <ProviderPage/>}</PrivateRoute></Route>
        <Route path="/workspace/admin"><PrivateRoute role="admin">{() => <AdminPage/>}</PrivateRoute></Route>
        <Route path="/map"><Redirect to="/demo/map"/></Route>
        <Route path="/pets"><Redirect to="/demo/pets"/></Route>
        <Route path="/directory"><Redirect to="/demo/directory"/></Route>
        <Route path="/services"><Redirect to="/demo/services"/></Route>
        <Route path="/admin"><Redirect to="/demo/admin"/></Route>
        <Route><NotFound/></Route>
      </Switch><Toaster/></TooltipProvider></ApiAuthBridge>
    </QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><RouterContent/></WouterRouter>;
}
export default App;
