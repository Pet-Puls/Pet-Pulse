import { lazy, Suspense, useEffect, useRef } from 'react';
import { ClerkProvider, useClerk } from '@clerk/react';
import type { MeProfile } from '@workspace/api-client-react';
import {
  QueryClientProvider, useQueryClient,
} from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ApiAuthBridge } from '@/app/auth';
import {
  clerkAppearance, clerkLocalization, clerkProxyUrl, clerkPubKey, basePath,
  queryClient, stripBase,
} from '@/app/config';
import { LoadingPanel, PrivateRoute } from '@/components/app-shared';
import { AppPreferences } from '@/components/AppPreferences';
import { TooltipProvider } from '@/components/ui/tooltip';
import PublicHomePage from '@/pages/PublicHomePage';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

const DemoApp = lazy(() => import('./DemoApp').then(module => ({ default: module.DemoApp })));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const AppointmentsPage = lazy(() => import('@/pages/AppointmentsPage'));
const DirectoryPage = lazy(() => import('@/pages/DirectoryPage'));
const LostPetsPage = lazy(() => import('@/pages/LostPetsPage'));
const SignInPage = lazy(() => import('@/pages/AuthPages').then(module => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/AuthPages').then(module => ({ default: module.SignUpPage })));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));
const PetsPage = lazy(() => import('@/pages/PetsPage'));
const ProviderPage = lazy(() => import('@/pages/ProviderPage'));
const PublicPetPage = lazy(() => import('@/pages/PublicPetPage'));
const WorkspaceHomePage = lazy(() => import('@/pages/WorkspaceHomePage'));
const WorkspaceMapPage = lazy(() => import('./components/WorkspaceMapPage'));

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

function RouteLoadingState() {
  return <main className="account-content"><LoadingPanel label="Preparando esta sección…"/></main>;
}

function WorkspaceRoutes({ me }: { me: MeProfile }) {
  return <Suspense fallback={<LoadingPanel label="Preparando esta sección…"/>}><Switch>
    <Route path="/workspace/appointments"><AppointmentsPage me={me}/></Route>
    <Route path="/workspace"><WorkspaceHomePage me={me}/></Route>
    <Route path="/workspace/map"><WorkspaceMapPage/></Route>
    <Route path="/workspace/lost-pets"><LostPetsPage me={me}/></Route>
    <Route path="/workspace/directory"><DirectoryPage embedded/></Route>
    <Route path="/workspace/pets">{me.role === 'owner' ? <PetsPage/> : <Redirect to="/workspace" replace/>}</Route>
    <Route path="/workspace/provider">{me.role === 'provider' ? <ProviderPage/> : <Redirect to="/workspace" replace/>}</Route>
    <Route path="/workspace/admin">{me.role === 'admin' ? <AdminPage/> : <Redirect to="/workspace" replace/>}</Route>
    <Route><NotFound/></Route>
  </Switch></Suspense>;
}

function RouterContent() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={clerkLocalization}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator/>
      <ApiAuthBridge><TooltipProvider><Suspense fallback={<RouteLoadingState/>}><Switch>
        <Route path="/" component={PublicHomePage}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/demo/*?"><DemoApp/></Route>
        <Route path="/pet/:token">{params => <PublicPetPage token={params.token}/>}</Route>
        <Route path="/onboarding" component={OnboardingPage}/>
        <Route path="/workspace/*?"><PrivateRoute>{me => <WorkspaceRoutes me={me}/>}</PrivateRoute></Route>
        <Route path="/map" component={WorkspaceMapPage}/>
        <Route path="/directory"><DirectoryPage/></Route>
        <Route path="/pets"><Redirect to="/demo/pets"/></Route>
        <Route path="/services"><Redirect to="/demo/services"/></Route>
        <Route path="/admin"><Redirect to="/demo/admin"/></Route>
        <Route><NotFound/></Route>
      </Switch></Suspense><Toaster/></TooltipProvider></ApiAuthBridge>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <><AppPreferences/><WouterRouter base={basePath}><RouterContent/></WouterRouter></>;
}

export default App;
