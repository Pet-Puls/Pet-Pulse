import { QueryClient } from '@tanstack/react-query';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  setBaseUrl,
} from '@workspace/api-client-react';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 } },
});

export const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || null;
setBaseUrl(apiBaseUrl);
export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
if (import.meta.env.PROD && !apiBaseUrl) {
  throw new Error(
    'Missing VITE_API_BASE_URL: define la URL de la API (Render) en las variables de Vercel y vuelve a desplegar.',
  );
}

export const clerkAppearance = {
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

export const clerkLocalization = {
  signIn: { start: { title: 'Qué gusto verte', subtitle: 'Entra a tu espacio PetPulse' } },
  signUp: { start: { title: 'Cuidemos en comunidad', subtitle: 'Crea tu cuenta PetPulse' } },
};
