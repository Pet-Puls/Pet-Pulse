import { useAuth } from '@clerk/react';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';
import {
  ArrowRight, Heart, PawPrint, ShieldCheck,
} from 'lucide-react';
import { Link, Redirect } from 'wouter';
import { useApiAuthReady } from '@/app/auth';
import { ActionLink, Brand } from '@/components/app-shared';

export default function PublicHomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const apiAuthReady = useApiAuthReady();
  const me = useGetMe({ query: { enabled: isLoaded && isSignedIn === true && apiAuthReady, queryKey: getGetMeQueryKey(), retry: false } });
  if (isLoaded && isSignedIn && apiAuthReady && me.data) return <Redirect to={me.data.onboardingCompleted ? '/workspace' : '/onboarding'} />;

  return <div className="public-shell">
    <header className="public-nav"><Brand /><nav className="public-nav-actions" aria-label="Acceso">
      <Link className="public-link" href="/map">Mapa cercano</Link>
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
