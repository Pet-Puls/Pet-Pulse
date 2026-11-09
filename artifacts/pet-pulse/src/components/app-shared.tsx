import { useAuth, useClerk } from '@clerk/react';
import {
  getGetMeQueryKey, useGetMe,
} from '@workspace/api-client-react';
import type { MeProfile } from '@workspace/api-client-react';
import {
  ChevronRight, Home, LogOut, MapPin, PawPrint, RefreshCw, ShieldCheck, Store,
} from 'lucide-react';
import { Link, Redirect, useLocation } from 'wouter';
import type { ReactNode } from 'react';
import { useApiAuthReady } from '@/app/auth';
import { basePath } from '@/app/config';

export function Brand({ className = '' }: { className?: string }) {
  return <Link href="/" className={`public-brand ${className}`}><img src={`${basePath}/logo.svg`} alt="" />petpulse</Link>;
}

export function ActionLink({ href, children, light = false }: { href: string; children: ReactNode; light?: boolean }) {
  return <Link href={href} className={`account-button ${light ? 'light' : ''}`}>{children}</Link>;
}

export function LoadingPanel({ label = 'Cargando tu espacio…' }: { label?: string }) {
  return <div className="account-panel" role="status" aria-live="polite"><p className="account-kicker">{label}</p><div className="loading-line"/><div className="loading-line" style={{ width: '72%' }}/><div className="loading-line" style={{ width: '46%' }}/></div>;
}

export function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-box" role="alert"><span>{message}</span><button className="account-button tiny" onClick={retry}><RefreshCw size={13}/> Reintentar</button></div>;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No pudimos completar la solicitud. Inténtalo de nuevo.';
}

export function PageHeading({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="account-heading"><div><div className="account-kicker">{kicker}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

export function AccountFrame({ me, children }: { me: MeProfile; children: ReactNode }) {
  const [path] = useLocation();
  const { signOut } = useClerk();
  const nav = [
    { href: '/workspace', label: 'Resumen', icon: Home },
    { href: '/workspace/map', label: 'Mapa cercano', icon: MapPin },
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

export function PrivateRoute({ children, role }: { children: (me: MeProfile) => ReactNode; role?: MeProfile['role'] }) {
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
