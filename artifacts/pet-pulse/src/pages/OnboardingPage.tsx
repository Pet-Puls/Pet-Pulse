import { useState, type FormEvent } from 'react';
import { useAuth } from '@clerk/react';
import { ArrowRight, PawPrint, Store } from 'lucide-react';
import { Redirect } from 'wouter';
import { getGetMeQueryKey, useCompleteOnboarding, useGetMe } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiAuthReady } from '@/app/auth';
import { Brand, ErrorPanel, LoadingPanel, errorMessage } from '@/components/app-shared';

export default function OnboardingPage() {
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
