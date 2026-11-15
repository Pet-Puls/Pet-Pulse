import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@clerk/react';
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { apiBaseUrl } from './config';

const ApiAuthReadyContext = createContext(!apiBaseUrl);

export function ApiAuthBridge({ children }: { children: ReactNode }) {
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

export function useApiAuthReady() {
  return useContext(ApiAuthReadyContext);
}
