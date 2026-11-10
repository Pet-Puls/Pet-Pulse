import { SignIn, SignUp } from '@clerk/react';
import { basePath } from '@/app/config';
import { Brand } from '@/components/app-shared';

export function SignInPage() {
  return <div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Un lugar más sencillo para cuidar de ellos.</div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}/></div></div>;
}

export function SignUpPage() {
  return <div className="auth-screen"><Brand className="auth-brand"/><div><div className="auth-aside-copy">Empieza a coordinar su cuidado con confianza.</div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`}/></div></div>;
}
