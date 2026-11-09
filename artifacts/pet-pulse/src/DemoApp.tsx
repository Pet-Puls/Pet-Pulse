import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, Check, ChevronRight,
  CircleHelp, Clock3, Dog, Heart, Home, MapPin, Menu, Navigation, PawPrint,
  Plus, QrCode, Search, ShieldCheck, Store, Stethoscope, UserRound, Users,
  Waves, X, Star, Footprints, ScanLine, Bone, Building2, Bell, LocateFixed,
} from 'lucide-react';

type Role = 'owner' | 'provider' | 'admin';
type PetStatus = 'home' | 'walking' | 'lost';
type Pet = { id: string; name: string; species: string; breed: string; age: string; emergency: string; status: PetStatus; x: number; y: number; color: string };
type Provider = { id: string; name: string; category: string; neighborhood: string; rating: number; services: string[]; x: number; y: number };
type Appointment = { id: string; providerId: string; title: string; category: string; date: string; time: string; status: string };
type LostAlert = { petId: string; status: 'active' | 'resolved'; location: string; time: string };
const client = new QueryClient();
const seedPets: Pet[] = [
  { id: 'p-luna', name: 'Luna', species: 'Perra', breed: 'Mestiza · 4 años', age: '4 años', emergency: '+57 300 000 0000 · Marina', status: 'home', x: 35, y: 43, color: 'peach' },
  { id: 'p-nube', name: 'Nube', species: 'Gato', breed: 'Europeo · 2 años', age: '2 años', emergency: '+57 300 000 0000 · Marina', status: 'walking', x: 60, y: 59, color: 'sage' },
  { id: 'p-bruno', name: 'Bruno', species: 'Perro', breed: 'Beagle · 6 años', age: '6 años', emergency: '+57 300 000 0000 · Marina', status: 'home', x: 73, y: 34, color: 'lilac' },
];
const seedProviders: Provider[] = [
  { id: 'v1', name: 'Clínica Vet Alameda', category: 'Veterinaria', neighborhood: 'Malasaña', rating: 4.9, services: ['Consulta general', 'Vacunación', 'Urgencias'], x: 23, y: 34 },
  { id: 'v2', name: 'Patas al Parque', category: 'Paseador', neighborhood: 'Chamberí', rating: 4.8, services: ['Paseo individual', 'Paseo en grupo'], x: 73, y: 55 },
  { id: 'v3', name: 'La Casa de Kira', category: 'Guardería', neighborhood: 'La Latina', rating: 4.7, services: ['Día completo', 'Media jornada'], x: 47, y: 71 },
  { id: 'v4', name: 'Refugio El Olivar', category: 'Refugio', neighborhood: 'Lavapiés', rating: 4.9, services: ['Adopción', 'Acogida temporal'], x: 82, y: 26 },
  { id: 'v5', name: 'Mimo Animal', category: 'Tienda', neighborhood: 'Conde Duque', rating: 4.6, services: ['Alimentación', 'Accesorios'], x: 34, y: 67 },
];
const seedAppointments: Appointment[] = [
  { id: 'a1', providerId: 'v1', title: 'Revisión anual de Luna', category: 'Veterinaria', date: '2026-08-18', time: '10:30', status: 'Confirmada' },
  { id: 'a2', providerId: 'v2', title: 'Paseo de Nube', category: 'Paseo', date: '2026-08-19', time: '17:00', status: 'Pendiente' },
];
const navigation = [
  { path: '/', label: 'Inicio', icon: Home },
  { path: '/map', label: 'Mapa en vivo', icon: MapPin },
  { path: '/pets', label: 'Mis mascotas', icon: PawPrint },
  { path: '/directory', label: 'Directorio', icon: Search },
  { path: '/services', label: 'Servicios', icon: CalendarDays },
  { path: '/admin', label: 'Panel de control', icon: ShieldCheck },
];
const roleText: Record<Role, string> = { owner: 'Persona tutora', provider: 'Proveedor local', admin: 'Administración' };
const roleGreeting: Record<Role, string> = { owner: 'Qué bueno tenerte por aquí', provider: 'Tu comunidad te espera', admin: 'Todo bajo control' };
const pageTitle: Record<string, string> = { '/': 'Inicio', '/map': 'Mapa en vivo', '/pets': 'Mis mascotas', '/directory': 'Directorio local', '/services': 'Servicios y citas', '/admin': 'Operaciones' };
function readSaved<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(`petpulse-${key}`); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}

function AppState({ children }: { children: (state: State) => ReactNode }) {
  const [role, setRole] = useState<Role>(() => readSaved('role', 'owner'));
  const [pets, setPets] = useState<Pet[]>(() => readSaved('pets', seedPets));
  const [providers, setProviders] = useState<Provider[]>(() => readSaved('providers', seedProviders));
  const [appointments, setAppointments] = useState<Appointment[]>(() => readSaved('appointments', seedAppointments));
  const [alerts, setAlerts] = useState<LostAlert[]>(() => readSaved('alerts', []));
  const [toast, setToast] = useState('');
  useEffect(() => { localStorage.setItem('petpulse-role', JSON.stringify(role)); }, [role]);
  useEffect(() => { localStorage.setItem('petpulse-pets', JSON.stringify(pets)); }, [pets]);
  useEffect(() => { localStorage.setItem('petpulse-providers', JSON.stringify(providers)); }, [providers]);
  useEffect(() => { localStorage.setItem('petpulse-appointments', JSON.stringify(appointments)); }, [appointments]);
  useEffect(() => { localStorage.setItem('petpulse-alerts', JSON.stringify(alerts)); }, [alerts]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3000); return () => window.clearTimeout(timer); }, [toast]);
  const notify = (message: string) => setToast(message);
  const state: State = { role, setRole, pets, setPets, providers, setProviders, appointments, setAppointments, alerts, setAlerts, notify };
  return <>{children(state)}{toast && <div role="status" className="toast" data-testid="status-toast">{toast}</div>}</>;
}
type State = { role: Role; setRole: (r: Role) => void; pets: Pet[]; setPets: (p: Pet[] | ((prev: Pet[]) => Pet[])) => void; providers: Provider[]; setProviders: (p: Provider[] | ((prev: Provider[]) => Provider[])) => void; appointments: Appointment[]; setAppointments: (a: Appointment[] | ((prev: Appointment[]) => Appointment[])) => void; alerts: LostAlert[]; setAlerts: (a: LostAlert[] | ((prev: LostAlert[]) => LostAlert[])) => void; notify: (s: string) => void };

function Shell({ children, state }: { children: ReactNode; state: State }) {
  const [path] = useLocation();
  const activeAlerts = state.alerts.filter(a => a.status === 'active');
  const menuItems = state.role === 'provider'
    ? [navigation[0], navigation[1], navigation[3], navigation[4], navigation[5], navigation[2]]
    : state.role === 'admin' ? [navigation[0], navigation[5], navigation[1], navigation[3], navigation[2], navigation[4]] : navigation;
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><PawPrint size={21} strokeWidth={2.7}/></span>petpulse</div>
      <div className="nav-label">Tu espacio</div>
      <nav aria-label="Navegación principal">{menuItems.map(item => {
        const Icon = item.icon;
        return <Link key={item.path} href={item.path} className={`nav-link ${path === item.path ? 'active' : ''}`} data-testid={`link-nav-${item.path === '/' ? 'home' : item.path.slice(1)}`}><Icon size={17}/>{item.label}{item.path === '/admin' && activeAlerts.length > 0 && <span style={{ marginLeft: 'auto', background: '#d56856', color: 'white', borderRadius: 99, padding: '2px 7px', fontSize: 10 }}>{activeAlerts.length}</span>}</Link>;
      })}</nav>
      <div className="side-bottom"><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 9 }}><CircleHelp size={15}/> Un lugar más seguro para ellos.</div><div>Prototipo interactivo · datos simulados</div></div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div className="crumb">Madrid <span style={{ margin: '0 8px', color: '#b7bcb1' }}>/</span><strong style={{ color: '#315c52' }}>{pageTitle[path] || 'PetPulse'}</strong></div>
        <div className="top-right">
          <label className="role-select"><UserRound size={15}/><span className="desktop-role">Vista:</span><select aria-label="Cambiar perfil" data-testid="select-role" value={state.role} onChange={e => { state.setRole(e.target.value as Role); state.notify(`Vista cambiada: ${roleText[e.target.value as Role]}`); }}><option value="owner">Persona tutora</option><option value="provider">Proveedor local</option><option value="admin">Administración</option></select></label>
          <div className="mini-avatar" aria-label="Perfil Marina">MR</div>
        </div>
      </header>
      {activeAlerts.length > 0 && <div style={{ background: '#c8554b', color: 'white', padding: '9px 4.2%', display: 'flex', gap: 9, alignItems: 'center', fontSize: 12, fontWeight: 700 }} data-testid="banner-global-alert"><AlertTriangle size={15}/> Alerta activa: {activeAlerts.map(a => state.pets.find(p => p.id === a.petId)?.name || 'Mascota').join(', ')} necesita ayuda <Link href="/admin" style={{ color: '#fff', marginLeft: 'auto' }}>Ver alerta <ArrowRight size={13} style={{ verticalAlign: 'middle' }}/></Link></div>}
      {children}
    </div>
    <nav className="mobile-nav" aria-label="Navegación móvil">{menuItems.map(item => { const Icon = item.icon; return <Link key={item.path} href={item.path} className={path === item.path ? 'active' : ''} data-testid={`mobile-nav-${item.path === '/' ? 'home' : item.path.slice(1)}`}><Icon size={19}/><span>{item.label.replace('Mis ', '')}</span></Link>; })}</nav>
  </div>;
}

function Heading({ eyebrow, title, desc, action }: { eyebrow: string; title: string; desc: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1 className="display">{title}</h1><p className="subtle" style={{ margin: 0 }}>{desc}</p></div>{action}</div>;
}
function Stat({ icon: Icon, label, value, note }: { icon: typeof PawPrint; label: string; value: string; note: string }) {
  return <div className="panel stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={17}/></span></div><div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div></div>;
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><div className="eyebrow">PetPulse · formulario</div><h2 className="display" id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar" data-testid="button-close-modal"><X size={17}/></button></div>{children}</section></div>;
}
function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) {
  return <div className={`form-field ${full ? 'full' : ''}`}><label className="field-label">{label}{children}</label></div>;
}
function petPhoto(pet: Pet) {
  if (pet.species.toLowerCase().includes('gato')) return 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80';
  if (pet.breed.toLowerCase().includes('beagle')) return 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=80';
  return 'https://images.unsplash.com/photo-1693615774599-ea266ebf51f4?auto=format&fit=crop&w=900&q=80';
}
function petQrValue(pet: Pet) {
  const phone = pet.emergency?.match(/\+?\d[\d\s().-]{7,}/)?.[0]?.replace(/[^\d+]/g, '');
  return phone ? `tel:${phone}` : 'Teléfono de emergencia no indicado';
}
function PetQrCode({ pet, size = 120 }: { pet: Pet; size?: number }) {
  return <QRCodeSVG
    value={petQrValue(pet)}
    size={size}
    level="M"
    marginSize={4}
    bgColor="#ffffff"
    fgColor="#174d49"
    title={`Código QR de emergencia de ${pet.name}`}
    className="qr-generated"
  />;
}
function PetCard({ pet, onQR, onLost }: { pet: Pet; onQR: () => void; onLost: () => void }) {
  return <article className="panel pet-card" data-testid={`card-pet-${pet.id}`}>
    <div className={`pet-art ${pet.color}`}><img className="pet-photo" src={petPhoto(pet)} alt={`Foto de ${pet.name}`} loading="lazy"/><span className={`status ${pet.status}`} style={{ position: 'absolute', top: 13, right: 13 }}>{pet.status === 'home' ? 'En casa' : pet.status === 'walking' ? 'De paseo' : 'Perdida'}</span></div>
    <div className="pet-info"><div className="pet-info-top"><div><h3 className="display" style={{ fontSize: 19 }}>{pet.name}</h3><p className="pet-meta">{pet.breed}</p></div><span style={{ color: '#d4a348' }}><Heart size={18}/></span></div>
      <div className="pet-actions"><button className="btn ghost small" onClick={onQR} data-testid={`button-qr-${pet.id}`}><QrCode size={14}/> QR de {pet.name}</button><button className={`btn small ${pet.status === 'lost' ? 'secondary' : 'danger'}`} onClick={onLost} data-testid={`button-alert-${pet.id}`}>{pet.status === 'lost' ? <><Check size={14}/> Resolver</> : <><AlertTriangle size={13}/> Alerta</>}</button></div>
    </div>
  </article>;
}
function HomePage({ state }: { state: State }) {
  const upcoming = state.appointments.filter(a => a.status !== 'Cancelada').slice(0, 2);
  const [qrPet, setQrPet] = useState<Pet | null>(null);
  const toggleLost = (pet: Pet) => {
    if (pet.status === 'lost') {
      state.setPets(prev => prev.map(p => p.id === pet.id ? { ...p, status: 'home' } : p));
      state.setAlerts(prev => prev.map(a => a.petId === pet.id && a.status === 'active' ? { ...a, status: 'resolved' } : a));
      state.notify(`Alerta de ${pet.name} resuelta. ¡Qué alivio!`);
    } else {
      state.setPets(prev => prev.map(p => p.id === pet.id ? { ...p, status: 'lost' } : p));
      state.setAlerts(prev => [{ petId: pet.id, status: 'active', location: 'Plaza del Dos de Mayo, Madrid', time: 'Ahora' }, ...prev.filter(a => a.petId !== pet.id)]);
      state.notify(`Alerta de ${pet.name} compartida con la red PetPulse.`);
    }
  };
  return <main className="content">
    <section className="welcome"><div className="welcome-copy"><div className="eyebrow">{roleGreeting[state.role]} · Marina</div><h1 className="display">Cuidarles, ahora<br/>un poco más fácil.</h1><p>Todo lo importante de su bienestar, sus paseos y las personas que los cuidan, en un mismo lugar.</p><Link href="/map" className="btn" data-testid="button-welcome-map"><MapPin size={16}/> Explorar mi zona <ArrowRight size={15}/></Link></div><div className="welcome-art"><PawPrint size={66} strokeWidth={1.5}/></div></section>
    <div className="grid grid-3 stat-grid"><Stat icon={PawPrint} label="Mascotas en tu perfil" value={String(state.pets.length).padStart(2, '0')} note="Identificadas y cuidadas"/><Stat icon={CalendarDays} label="Próxima cita" value={upcoming.length ? upcoming[0].time : '—'} note={upcoming.length ? `${upcoming[0].date} · ${upcoming[0].title}` : 'Sin citas próximas'}/><Stat icon={MapPin} label="Cuidados cerca" value={String(state.providers.length).padStart(2, '0')} note="Proveedores en tu barrio"/></div>
    <div className="section-row"><h2 className="display">Su pequeña manada</h2><Link href="/pets" className="text-link">Ver perfiles <ArrowRight size={14}/></Link></div>
    <div className="grid grid-3">{state.pets.slice(0, 3).map(pet => <PetCard key={pet.id} pet={pet} onQR={() => setQrPet(pet)} onLost={() => toggleLost(pet)}/>)}</div>
    <div className="grid grid-2" style={{ marginTop: 22 }}><section className="panel"><div className="section-row" style={{ marginTop: 0 }}><h2 className="display">Lo que viene</h2><Link href="/services" className="text-link">Todas las citas <ArrowRight size={14}/></Link></div>{upcoming.length ? upcoming.map(a => <AppointmentRow key={a.id} appointment={a} provider={state.providers.find(p => p.id === a.providerId)}/>) : <Empty icon={CalendarDays} title="Tu agenda está libre" text="Encuentra cuidado de confianza en tu zona."/>}</section><section className="panel" style={{ background: '#f4ead5' }}><div className="eyebrow">Red PetPulse</div><h2 className="display">Un barrio que cuida.</h2><p className="subtle">Encuentra profesionales locales y conoce a quienes comparten tus paseos.</p><Link href="/directory" className="btn secondary" data-testid="button-directory-home"><Store size={16}/> Descubrir profesionales <ArrowRight size={15}/></Link><div style={{ display: 'flex', gap: 9, marginTop: 22, alignItems: 'center', color: '#5d7668', fontSize: 11 }}><ShieldCheck size={18}/> Perfiles locales con información clara</div></section></div>
    <div className="notice" style={{ marginTop: 20 }}><LocateFixed size={16}/> <span><strong>Una nota importante:</strong> Las ubicaciones y los datos de este prototipo son simulados. PetPulse no utiliza GPS real ni servicios conectados.</span></div>
    {qrPet && <Modal title={`Tarjeta QR de ${qrPet.name}`} onClose={() => setQrPet(null)}><div className="qr-card"><div className="qr-card-top"><img src={petPhoto(qrPet)} alt={`Foto de ${qrPet.name}`} className="qr-pet-photo"/><div><span className="eyebrow">Identificación PetPulse</span><strong className="display qr-pet-name">{qrPet.name}</strong><span className="qr-pet-meta">{qrPet.species} · {qrPet.breed.split(' · ')[0]} · {qrPet.age || 'Edad no indicada'}</span></div></div><div className="qr-card-bottom"><div><div className="eyebrow">Teléfono de emergencia</div><strong>{qrPet.emergency || 'Contacto no indicado'}</strong></div><PetQrCode pet={qrPet} size={128}/></div><p className="subtle qr-caption">Al escanear, se abre el marcador con el número de emergencia.</p></div></Modal>}
  </main>;
}
function AppointmentRow({ appointment, provider }: { appointment: Appointment; provider?: Provider }) {
  const [day, month] = appointment.date.split('-').slice(1).reverse();
  return <div className="appointment" data-testid={`appointment-${appointment.id}`}><div className="date-tile"><strong>{day}</strong><span>{month === '06' ? 'jun' : month}</span></div><div className="appointment-main"><strong>{appointment.title}</strong><p>{provider?.name || 'Profesional'} · {appointment.time}</p></div><span className="pill">{appointment.status}</span></div>;
}
function Empty({ icon: Icon, title, text }: { icon: typeof PawPrint; title: string; text: string }) { return <div className="empty-state"><Icon size={27}/><h3>{title}</h3><p>{text}</p></div>; }

function PetPage({ state }: { state: State }) {
  const [showAdd, setShowAdd] = useState(false);
  const [qrPet, setQrPet] = useState<Pet | null>(null);
  useEffect(() => {
    const onQR = (event: Event) => { const id = (event as CustomEvent<string>).detail; const pet = state.pets.find(p => p.id === id); if (pet) setQrPet(pet); };
    const onLost = (event: Event) => { const id = (event as CustomEvent<string>).detail; const pet = state.pets.find(p => p.id === id); if (pet) toggleLost(pet); };
    window.addEventListener('petpulse:qr', onQR); window.addEventListener('petpulse:lost', onLost);
    return () => { window.removeEventListener('petpulse:qr', onQR); window.removeEventListener('petpulse:lost', onLost); };
  });
  const toggleLost = (pet: Pet) => {
    if (pet.status === 'lost') { state.setPets(prev => prev.map(p => p.id === pet.id ? { ...p, status: 'home' } : p)); state.setAlerts(prev => prev.map(a => a.petId === pet.id && a.status === 'active' ? { ...a, status: 'resolved' } : a)); state.notify(`Alerta de ${pet.name} resuelta. ¡Qué alivio!`); }
    else { state.setPets(prev => prev.map(p => p.id === pet.id ? { ...p, status: 'lost' } : p)); state.setAlerts(prev => [{ petId: pet.id, status: 'active', location: 'Plaza del Dos de Mayo, Madrid', time: 'Ahora' }, ...prev.filter(a => a.petId !== pet.id)]); state.notify(`Alerta de ${pet.name} compartida con la red PetPulse.`); }
  };
  return <main className="content">
    <Heading eyebrow="Su identidad, siempre a mano" title="Mis mascotas" desc="Perfiles sencillos para que cualquier persona pueda ayudarles." action={<button className="btn" onClick={() => setShowAdd(true)} data-testid="button-add-pet"><Plus size={16}/> Añadir mascota</button>}/>
    {state.pets.length === 0 ? <section className="panel"><Empty icon={PawPrint} title="Aún no hay mascotas" text="Crea el primer perfil para tener su información importante a mano."/></section> : <div className="grid grid-3">{state.pets.map(pet => <PetCard key={pet.id} pet={pet} onQR={() => setQrPet(pet)} onLost={() => toggleLost(pet)}/>)}</div>}
    <div className="section-row"><h2 className="display">Identificación de emergencia</h2></div><section className="panel grid grid-2" style={{ alignItems: 'center' }}><div><div className="stat-icon" style={{ width: 42, height: 42, marginBottom: 13 }}><ScanLine size={20}/></div><h2 className="display">Una ayuda a un escaneo de distancia.</h2><p className="subtle">Al escanear el QR, se abre el marcador del teléfono de emergencia. La edad aparece en la tarjeta.</p><button className="btn secondary" onClick={() => setQrPet(state.pets[0] || null)} disabled={!state.pets.length} data-testid="button-scan-qr"><QrCode size={16}/> Ver tarjeta QR</button></div><div style={{ display: 'flex', justifyContent: 'center' }}>{state.pets[0] ? <PetQrCode pet={state.pets[0]} size={160}/> : <div className="qr-preview" aria-label="Añade una mascota para generar su código QR"/>}</div></section>
    {showAdd && <Modal title="Nueva mascota" onClose={() => setShowAdd(false)}><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const name = String(f.get('name')).trim(); if (!name) return; const pet: Pet = { id: `p-${Date.now()}`, name, species: String(f.get('species')), breed: `${String(f.get('breed') || 'Sin raza indicada')} · ${String(f.get('age'))}`, age: String(f.get('age')), emergency: String(f.get('emergency')), status: 'home', x: 50, y: 50, color: ['peach', 'sage', 'lilac'][state.pets.length % 3] }; state.setPets(prev => [...prev, pet]); setShowAdd(false); state.notify(`${name} ya forma parte de PetPulse.`); }}><div className="form-grid"><Field label="Nombre"><input className="field" name="name" required placeholder="Ej. Chispa" data-testid="input-pet-name"/></Field><Field label="Especie"><select className="field" name="species" data-testid="select-pet-species"><option>Perro</option><option>Gato</option><option>Otro</option></select></Field><Field label="Raza"><input className="field" name="breed" placeholder="Ej. Mestiza" data-testid="input-pet-breed"/></Field><Field label="Edad"><input className="field" name="age" placeholder="Ej. 3 años" data-testid="input-pet-age"/></Field><Field label="Contacto de emergencia" full><input className="field" name="emergency" required placeholder="+57 300 000 0000 · Nombre" data-testid="input-emergency-contact"/></Field></div><div className="form-actions"><button type="button" className="btn ghost" onClick={() => setShowAdd(false)}>Cancelar</button><button className="btn" type="submit" data-testid="button-save-pet"><Plus size={15}/> Guardar perfil</button></div></form></Modal>}
    {qrPet && <Modal title={`Tarjeta QR de ${qrPet.name}`} onClose={() => setQrPet(null)}><div className="qr-card"><div className="qr-card-top"><img src={petPhoto(qrPet)} alt={`Foto de ${qrPet.name}`} className="qr-pet-photo"/><div><span className="eyebrow">Identificación PetPulse</span><strong className="display qr-pet-name">{qrPet.name}</strong><span className="qr-pet-meta">{qrPet.species} · {qrPet.breed.split(' · ')[0]} · {qrPet.age || 'Edad no indicada'}</span></div></div><div className="qr-card-bottom"><div><div className="eyebrow">Teléfono de emergencia</div><strong>{qrPet.emergency || 'Contacto no indicado'}</strong></div><PetQrCode pet={qrPet} size={128}/></div><p className="subtle qr-caption">Al escanear, se abre el marcador con el número de emergencia.</p></div></Modal>}
  </main>;
}

function MapPage({ state }: { state: State }) {
  const [tick, setTick] = useState(0);
  const move = () => { setTick(t => t + 1); state.setPets(prev => prev.map((p, i) => p.status === 'walking' ? { ...p, x: Math.max(16, Math.min(84, p.x + (i % 2 ? 7 : -5))), y: Math.max(19, Math.min(80, p.y + (i % 2 ? -5 : 6))) } : p)); state.notify('Ubicaciones simuladas actualizadas.'); };
  const offsets = [0, 1];
  return <main className="content"><Heading eyebrow="Tu barrio, de un vistazo" title="Mapa en vivo" desc="Mascotas y lugares de cuidado cercanos, en un mapa de demostración." action={<button className="btn" onClick={move} data-testid="button-move-pets"><Navigation size={15}/> Simular movimiento</button>}/>
    <div className="grid grid-3" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(220px,1fr)', alignItems: 'start' }}><div><div className="map-board" data-testid="map-simulated"><div className="map-grid"/><span className="map-label" style={{ top: '18%', left: '12%' }}>MALASAÑA</span><span className="map-label" style={{ top: '40%', left: '67%' }}>CHAMBERÍ</span><span className="map-label" style={{ top: '80%', left: '17%' }}>LA LATINA</span><span className="map-label" style={{ top: '70%', left: '69%' }}>LAVAPIÉS</span>
      {state.pets.map((pet, i) => <button key={pet.id} className={`map-pin ${pet.status === 'lost' ? 'lost' : ''}`} style={{ left: `${Math.max(8, Math.min(92, pet.x + (tick && pet.status === 'walking' ? offsets[i % 2] : 0)))}%`, top: `${pet.y}%` }} title={`${pet.name}: ${pet.status}`} data-testid={`map-pet-${pet.id}`} onClick={() => state.notify(`${pet.name} · ${pet.status === 'home' ? 'En casa' : pet.status === 'walking' ? 'De paseo' : 'Alerta activa'}`)}><PawPrint size={13}/>{pet.name}</button>)}
      {state.providers.slice(0, 4).map(p => <button key={p.id} className="map-pin provider" style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => state.notify(`${p.name} · ${p.category}`)} data-testid={`map-provider-${p.id}`}><MapPin size={12}/>{p.name.split(' ')[0]}</button>)}
    </div><div className="map-key" style={{ marginTop: 13 }}><span><i className="dot"/>Mascota</span><span><i className="dot gold"/>Proveedor local</span><span><i className="dot red"/>Alerta</span></div></div>
    <aside className="panel"><div className="eyebrow">En tu zona</div><h2 className="display">La red cercana</h2><p className="subtle">Una muestra de personas y lugares de cuidado.</p>{state.pets.map(p => <div className="appointment" key={p.id}><div className="stat-icon"><PawPrint size={16}/></div><div className="appointment-main"><strong>{p.name}</strong><p>{p.status === 'home' ? 'En casa' : p.status === 'walking' ? 'De paseo · ubicación aproximada' : 'Alerta de mascota perdida'}</p></div><span className={`status ${p.status}`}>{p.status === 'home' ? 'Casa' : p.status === 'walking' ? 'Paseo' : 'Alerta'}</span></div>)}<Link className="btn ghost" href="/directory" style={{ width: '100%', marginTop: 14 }}><Search size={15}/> Ver proveedores cercanos</Link></aside></div>
    <div className="notice" style={{ marginTop: 19 }}><LocateFixed size={16}/> <span>Ubicaciones ilustrativas en Madrid. No se solicita acceso a GPS y no hay seguimiento real.</span></div>
  </main>;
}

function DirectoryPage({ state }: { state: State }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [booking, setBooking] = useState<Provider | null>(null);
  const categories = ['Todas', 'Veterinaria', 'Guardería', 'Paseador', 'Refugio', 'Tienda'];
  const results = useMemo(() => state.providers.filter(p => (category === 'Todas' || p.category === category) && `${p.name} ${p.category} ${p.neighborhood} ${p.services.join(' ')}`.toLowerCase().includes(search.toLowerCase())), [state.providers, category, search]);
  return <main className="content"><Heading eyebrow="Cuidado con nombre y apellidos" title="Cerca, de confianza." desc="Encuentra profesionales locales para cada momento de su cuidado."/>
    <section className="panel" style={{ marginBottom: 18 }}><div className="search-row"><div className="input-wrap"><Search size={17}/><input className="field" value={search} onChange={e => setSearch(e.target.value)} placeholder="Busca por servicio, nombre o barrio" aria-label="Buscar proveedores" data-testid="input-provider-search"/></div><label className="field-label" style={{ margin: 0 }}><span className="sr-only">Categoría</span><select className="field" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filtrar por categoría" style={{ minWidth: 155 }} data-testid="select-provider-category">{categories.map(c => <option key={c}>{c}</option>)}</select></label></div><div className="provider-tags">{categories.map(c => <button key={c} className={`tag ${category === c ? 'selected' : ''}`} style={{ border: 0, cursor: 'pointer', background: category === c ? '#28655b' : undefined, color: category === c ? 'white' : undefined }} onClick={() => setCategory(c)} data-testid={`filter-${c.toLowerCase()}`}>{c}</button>)}</div><div style={{ fontSize: 11, color: '#7d8b82' }}>{results.length} profesionales en la muestra · Madrid</div></section>
    {results.length ? <div className="grid grid-2">{results.map(provider => <ProviderCard key={provider.id} provider={provider} onBook={() => setBooking(provider)}/>)}</div> : <section className="panel"><Empty icon={Search} title="No encontramos coincidencias" text="Prueba con otra categoría, barrio o palabra de búsqueda."/></section>}
    <div className="notice" style={{ marginTop: 19 }}><ShieldCheck size={16}/> <span>Directorio de muestra. Los nombres y servicios son simulados; confirma la disponibilidad directamente con cada profesional.</span></div>
    {booking && <Modal title="Pedir una cita" onClose={() => setBooking(null)}><p className="subtle">Solicita un horario a <strong>{booking.name}</strong>. Es una reserva de demostración.</p><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const appointment: Appointment = { id: `a-${Date.now()}`, providerId: booking.id, title: `${String(f.get('service'))} · ${String(f.get('pet'))}`, category: booking.category, date: String(f.get('date')), time: String(f.get('time')), status: 'Pendiente' }; state.setAppointments(prev => [appointment, ...prev]); setBooking(null); state.notify(`Solicitud enviada a ${booking.name}.`); }}><div className="form-grid"><Field label="Mascota"><select className="field" name="pet" data-testid="select-booking-pet">{state.pets.map(p => <option key={p.id}>{p.name}</option>)}</select></Field><Field label="Servicio"><select className="field" name="service" data-testid="select-booking-service">{booking.services.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="Fecha"><input type="date" className="field" name="date" required defaultValue="2026-08-24" data-testid="input-booking-date"/></Field><Field label="Hora"><input type="time" className="field" name="time" required defaultValue="10:00" data-testid="input-booking-time"/></Field></div><div className="form-actions"><button type="button" className="btn ghost" onClick={() => setBooking(null)}>Cancelar</button><button className="btn" type="submit" data-testid="button-submit-booking"><CalendarDays size={15}/> Solicitar cita</button></div></form></Modal>}
  </main>;
}
function ProviderCard({ provider, onBook }: { provider: Provider; onBook: () => void }) {
  const Icon = provider.category === 'Veterinaria' ? Stethoscope : provider.category === 'Paseador' ? Footprints : provider.category === 'Tienda' ? Store : provider.category === 'Refugio' ? Heart : Dog;
  return <article className="panel provider-card" data-testid={`card-provider-${provider.id}`}><div className="provider-icon"><Icon size={23}/></div><div className="provider-details"><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><h3 className="display" style={{ fontSize: 17 }}>{provider.name}</h3><div className="provider-line"><MapPin size={12} style={{ verticalAlign: 'middle' }}/> {provider.neighborhood} · {provider.category}</div></div><span className="rating"><Star size={13} fill="currentColor" style={{ verticalAlign: 'middle' }}/> {provider.rating}</span></div><div className="provider-tags">{provider.services.map(s => <span className="tag" key={s}>{s}</span>)}</div><button className="btn small" onClick={onBook} data-testid={`button-book-${provider.id}`}><CalendarDays size={14}/> Pedir cita</button></div></article>;
}
function ServicesPage({ state }: { state: State }) {
  const [showService, setShowService] = useState(false);
  const [providerId, setProviderId] = useState(state.providers[0]?.id || '');
  const [filter, setFilter] = useState('Todas');
  const visible = state.appointments.filter(a => filter === 'Todas' || a.status === filter);
  const isProvider = state.role === 'provider';
  return <main className="content"><Heading eyebrow={isProvider ? 'Tu agenda profesional' : 'Rutinas que les hacen bien'} title={isProvider ? 'Servicios y agenda' : 'Citas y servicios'} desc={isProvider ? 'Gestiona tu oferta y revisa las próximas solicitudes.' : 'Organiza sus cuidados y descubre qué puedes reservar.'} action={isProvider ? <button className="btn" onClick={() => setShowService(true)} data-testid="button-add-service"><Plus size={16}/> Añadir servicio</button> : <Link href="/directory" className="btn" data-testid="button-find-service"><Search size={15}/> Encontrar un servicio</Link>}/>
    {isProvider && <section className="panel" style={{ marginBottom: 19, background: '#e8f0e5' }}><div className="eyebrow">Tu espacio de proveedor</div><h2 className="display">Una buena experiencia empieza aquí.</h2><p className="subtle">Añade servicios para que las personas de tu zona sepan en qué puedes ayudarles.</p><button className="btn secondary" onClick={() => setShowService(true)}><Plus size={15}/> Publicar un servicio</button></section>}
    <div className="grid grid-2" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(260px,.7fr)' }}><section className="panel"><div className="section-row" style={{ marginTop: 0 }}><div><div className="eyebrow">Agenda compartida</div><h2 className="display">Próximas citas</h2></div><select className="field" style={{ width: 138 }} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filtrar citas" data-testid="select-appointment-filter"><option>Todas</option><option>Confirmada</option><option>Pendiente</option><option>Cancelada</option></select></div>{visible.length ? visible.map(a => <AppointmentRow key={a.id} appointment={a} provider={state.providers.find(p => p.id === a.providerId)}/>) : <Empty icon={CalendarDays} title="Agenda despejada" text="Las nuevas citas aparecerán aquí."/ >}</section><aside><section className="panel" style={{ background: '#f3e6cb' }}><div className="stat-icon"><Clock3 size={17}/></div><h2 className="display" style={{ marginTop: 13 }}>Un paso a la vez.</h2><p className="subtle">Las solicitudes nuevas se muestran como pendientes hasta que el profesional las confirme.</p><Link href="/directory" className="text-link">Explorar directorio <ArrowRight size={14}/></Link></section><section className="panel" style={{ marginTop: 15 }}><div className="eyebrow">En la red local</div><strong className="display" style={{ fontSize: 24 }}>{state.providers.length} profesionales</strong><p className="subtle" style={{ margin: '6px 0 15px' }}>disponibles en la muestra de Madrid</p><Link href="/map" className="btn ghost small"><MapPin size={14}/> Ver en el mapa</Link></section></aside></div>
    {showService && <Modal title="Publicar un servicio" onClose={() => setShowService(false)}><p className="subtle">Agrega una opción a la ficha de tu negocio. El cambio se guarda en este dispositivo.</p><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const title = String(f.get('title')).trim(); const provider = state.providers.find(p => p.id === providerId) || state.providers[0]; if (!title || !provider) return; state.setProviders(prev => prev.map(p => p.id === provider.id ? { ...p, services: [...p.services, title] } : p)); setShowService(false); state.notify(`Servicio «${title}» añadido a ${provider.name}.`); }}><div className="form-grid"><Field label="Establecimiento" full><select className="field" value={providerId} onChange={e => setProviderId(e.target.value)} data-testid="select-service-provider">{state.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Nombre del servicio"><input className="field" name="title" required placeholder="Ej. Baño y cepillado" data-testid="input-service-name"/></Field><Field label="Categoría"><select className="field" name="category" data-testid="select-service-category"><option>Cuidado</option><option>Veterinaria</option><option>Paseo</option><option>Guardería</option></select></Field></div><div className="form-actions"><button type="button" className="btn ghost" onClick={() => setShowService(false)}>Cancelar</button><button className="btn" type="submit" data-testid="button-save-service"><Plus size={15}/> Añadir a servicios</button></div></form></Modal>}
  </main>;
}
function AdminPage({ state }: { state: State }) {
  const active = state.alerts.filter(a => a.status === 'active');
  const resolve = (petId: string) => { state.setAlerts(prev => prev.map(a => a.petId === petId ? { ...a, status: 'resolved' } : a)); state.setPets(prev => prev.map(p => p.id === petId ? { ...p, status: 'home' } : p)); state.notify('Alerta resuelta y red actualizada.'); };
  return <main className="content"><Heading eyebrow="Vista de operaciones" title="Una red que responde." desc="Estado general de la demo, con atención especial a las alertas activas."/>
    <div className="grid grid-4 stat-grid"><Stat icon={Users} label="Proveedores" value={String(state.providers.length).padStart(2, '0')} note="Perfiles locales simulados"/><Stat icon={PawPrint} label="Mascotas" value={String(state.pets.length).padStart(2, '0')} note="En la red de muestra"/><Stat icon={CalendarDays} label="Citas" value={String(state.appointments.length).padStart(2, '0')} note="Guardadas en el dispositivo"/><Stat icon={Activity} label="Alertas activas" value={String(active.length).padStart(2, '0')} note={active.length ? 'Requieren seguimiento' : 'Sin incidencias activas'}/></div>
    <div className="section-row"><h2 className="display">Alertas de mascotas perdidas</h2><span className={`status ${active.length ? 'lost' : 'home'}`}>{active.length ? `${active.length} activa${active.length > 1 ? 's' : ''}` : 'Todo en calma'}</span></div>
    {active.length ? active.map(alert => { const pet = state.pets.find(p => p.id === alert.petId); if (!pet) return null; return <section key={alert.petId} className="alert-banner" data-testid={`alert-card-${alert.petId}`}><div style={{ display: 'flex', gap: 11, alignItems: 'center' }}><span className="stat-icon" style={{ background: '#f6d2c8', color: '#a54338' }}><AlertTriangle size={19}/></span><div><strong>{pet.name} · {pet.species} {pet.breed.split(' · ')[0]}</strong><p>Última ubicación simulada: {alert.location} · {alert.time}</p></div></div><button className="btn small" style={{ background: '#a6473d' }} onClick={() => resolve(pet.id)} data-testid={`button-resolve-${pet.id}`}><Check size={14}/> Marcar como encontrada</button></section>; }) : <section className="panel"><Empty icon={ShieldCheck} title="Por ahora, todo en calma" text="Si alguien activa una alerta de pérdida, aparecerá aquí para toda la red."/></section>}
    <div className="grid grid-2" style={{ marginTop: 18 }}><section className="panel"><div className="eyebrow">Actividad de la red</div><h2 className="display">Pulso de PetPulse</h2><div className="appointment"><div className="stat-icon"><Building2 size={16}/></div><div className="appointment-main"><strong>Proveedores en el directorio</strong><p>Clínicas, paseos, refugios y más</p></div><strong>{state.providers.length}</strong></div><div className="appointment"><div className="stat-icon"><CalendarDays size={16}/></div><div className="appointment-main"><strong>Solicitudes de cita</strong><p>Guardadas de forma local</p></div><strong>{state.appointments.length}</strong></div><div className="appointment"><div className="stat-icon"><Bell size={16}/></div><div className="appointment-main"><strong>Alertas resueltas</strong><p>Seguimiento de la red</p></div><strong>{state.alerts.filter(a => a.status === 'resolved').length}</strong></div></section><section className="panel" style={{ background: '#e9f0e5' }}><div className="eyebrow">Transparencia</div><h2 className="display">Un prototipo, con límites claros.</h2><p className="subtle">Los perfiles, ubicaciones, movimientos y alertas son simulados. No hay GPS real, backend ni notificaciones externas. Los cambios se guardan solo en este navegador.</p><div className="notice"><ShieldCheck size={16}/> La información de emergencia solo se muestra en la ficha QR de demostración.</div></section></div>
  </main>;
}
function Router() {
  const [location] = useLocation();
  return <AppState>{state => <Shell state={state}><ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={() => <HomePage state={state}/>}/>
    <Route path="/map" component={() => <MapPage state={state}/>}/>
    <Route path="/pets" component={() => <PetPage state={state}/>}/>
    <Route path="/directory" component={() => <DirectoryPage state={state}/>}/>
    <Route path="/services" component={() => <ServicesPage state={state}/>}/>
    <Route path="/admin" component={() => <AdminPage state={state}/>}/>
    <Route component={NotFound}/>
  </Switch></ErrorBoundary></Shell>}</AppState>;
}
export function DemoApp() {
  return <QueryClientProvider client={client}><TooltipProvider><WouterRouter base={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/demo`}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>;
}
