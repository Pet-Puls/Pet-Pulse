import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initialTheme(): Theme {
  try {
    return localStorage.getItem('petpulse-theme') === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('No se pudo leer la preferencia de tema.', error);
    return 'light';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#142d28' : '#f6f3ea');
  try {
    localStorage.setItem('petpulse-theme', theme);
  } catch (error) {
    console.warn('No se pudo guardar la preferencia de tema.', error);
  }
}

export function AppPreferences() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installError, setInstallError] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => { setInstallPrompt(null); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setInstallPrompt(null);
    setInstallError(false);
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
    } catch (error) {
      console.error('No se pudo abrir la instalación de PetPulse.', error);
      setInstallError(true);
    }
  };

  return <div className="app-preferences" aria-label="Preferencias de la aplicación">
    <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Tema: {theme === 'light' ? 'claro' : 'oscuro'}
    </button>
    {!installed && (installPrompt
      ? <button type="button" onClick={() => void install()}>Instalar PetPulse</button>
      : <details><summary>Cómo instalar</summary><p>En Android, abre el menú del navegador y elige «Instalar aplicación». En iPhone, usa Compartir y «Agregar a pantalla de inicio».</p></details>)}
    {installError && <span role="alert">No se pudo abrir la instalación. Usa el menú de tu navegador.</span>}
  </div>;
}
