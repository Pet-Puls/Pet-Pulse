import { SignIn, SignUp, useAuth } from '@clerk/react';
import type { ReactNode } from 'react';
import { Redirect } from 'wouter';
import { basePath } from '@/app/config';
import { Brand, LoadingPanel } from '@/components/app-shared';

function AuthScreen({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <main className="account-content"><LoadingPanel label="Comprobando sesión…"/></main>;
  if (isSignedIn) return <Redirect to="/workspace" replace/>;
  return children;
}

export function SignInPage() {
  return <AuthScreen><div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Un lugar más sencillo para cuidar de ellos.</div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div></AuthScreen>;
}

export function SignUpPage() {
  return <AuthScreen><div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Empieza a coordinar su cuidado con confianza.</div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div></AuthScreen>;
}
