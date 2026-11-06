import { lazy, Suspense, useEffect, useRef } from 'react';
import { ClerkProvider, useClerk } from '@clerk/react';
import {
  QueryClientProvider, useQueryClient,
} from '@tanstack/react-query';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { DemoApp } from './DemoApp';
import { ApiAuthBridge } from '@/app/auth';
import {
  clerkAppearance, clerkLocalization, clerkProxyUrl, clerkPubKey, basePath,
  queryClient, stripBase,
} from '@/app/config';
import { LoadingPanel, PrivateRoute } from '@/components/app-shared';
import { TooltipProvider } from '@/components/ui/tooltip';
import AdminPage from '@/pages/AdminPage';
import { SignInPage, SignUpPage } from '@/pages/AuthPages';
import OnboardingPage from '@/pages/OnboardingPage';
import PetsPage from '@/pages/PetsPage';
import PublicHomePage from '@/pages/PublicHomePage';
import ProviderPage from '@/pages/ProviderPage';
import WorkspaceHomePage from '@/pages/WorkspaceHomePage';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import '@/index.css';

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

function MapLoadingState() {
  return <main className="account-content"><LoadingPanel label="Cargando el mapa…"/></main>;
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
        <Route path="/" component={PublicHomePage}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/demo/*?" component={DemoApp}/>
        <Route path="/onboarding" component={OnboardingPage}/>
        <Route path="/workspace"><PrivateRoute>{me => <WorkspaceHomePage me={me}/>}</PrivateRoute></Route>
        <Route path="/workspace/map"><PrivateRoute>{() => <Suspense fallback={<MapLoadingState/>}><WorkspaceMapPage/></Suspense>}</PrivateRoute></Route>
        <Route path="/workspace/pets"><PrivateRoute role="owner">{() => <PetsPage/>}</PrivateRoute></Route>
        <Route path="/workspace/provider"><PrivateRoute role="provider">{() => <ProviderPage/>}</PrivateRoute></Route>
        <Route path="/workspace/admin"><PrivateRoute role="admin">{() => <AdminPage/>}</PrivateRoute></Route>
        <Route path="/map"><Suspense fallback={<MapLoadingState/>}><WorkspaceMapPage/></Suspense></Route>
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
