import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, CircleHelp, ShieldCheck } from 'lucide-react';
import {
  getGetMeQueryKey, getGetProviderProfileQueryKey, useGetProviderProfile, useSaveProviderProfile,
} from '@workspace/api-client-react';
import type { ProviderProfileInput } from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';
import { providerCategories } from '@/features/providers';
import { ProviderAvailabilityPanel, ProviderServicesPanel } from './ProviderResourcesPanels';

export default function ProviderPage() {
  const client = useQueryClient();
  const profile = useGetProviderProfile({ query: { queryKey: getGetProviderProfileQueryKey() } });
  const saveProfile = useSaveProviderProfile({ mutation: { onSuccess: result => {
    client.setQueryData(getGetProviderProfileQueryKey(), result);
    void client.invalidateQueries({ queryKey: getGetProviderProfileQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMeQueryKey() });
  } } });
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ProviderProfileInput['category']>('veterinary');
  const [neighborhood, setNeighborhood] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (profile.data && !initialized) {
      setName(profile.data.name); setCategory(profile.data.category);
      setNeighborhood(profile.data.neighborhood); setDescription(profile.data.description || '');
      setWebsiteUrl(profile.data.websiteUrl || '');
      setInstagramUrl(profile.data.instagramUrl || '');
      setFacebookUrl(profile.data.facebookUrl || '');
      setWhatsappUrl(profile.data.whatsappUrl || '');
      setInitialized(true);
    }
  }, [profile.data, initialized]);

  const submit = (event: FormEvent) => {
    event.preventDefault(); setNotice('');
    saveProfile.mutate({ data: {
      name: name.trim(),
      category,
      neighborhood: neighborhood.trim(),
      description: description.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      instagramUrl: instagramUrl.trim() || null,
      facebookUrl: facebookUrl.trim() || null,
      whatsappUrl: whatsappUrl.trim() || null,
    } }, {
      onSuccess: () => { setInitialized(true); setNotice('Tu perfil se guardó y está pendiente de revisión.'); },
    });
  };

  return <main className="account-content"><PageHeading kicker="Tu actividad local" title="Perfil de proveedor" subtitle="Presenta tu negocio con información clara para las personas de tu comunidad."/>
    {profile.isLoading && <LoadingPanel label="Cargando tu perfil comercial…"/>}
    {profile.isError && <ErrorPanel message={errorMessage(profile.error)} retry={() => void profile.refetch()}/>}
    {!profile.isLoading && !profile.isError && <div className="account-grid two">
      <section className="account-panel"><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 }}><div className="account-kicker">Datos del negocio</div><span className={`provider-status ${profile.data?.approvalStatus || 'pending'}`}>{profile.data ? profile.data.approvalStatus === 'approved' ? 'Aprobado' : profile.data.approvalStatus === 'suspended' ? 'Suspendido' : 'Pendiente' : 'Sin enviar'}</span></div>
        {notice && <div className="notice-box" role="status" style={{ marginBottom: 15 }}><BadgeCheck size={17}/>{notice}</div>}
        {saveProfile.isError && <div className="error-box" role="alert" style={{ marginBottom: 14 }}>{errorMessage(saveProfile.error)}</div>}
        <form className="account-form" onSubmit={submit}>
          <div className="account-field full"><label htmlFor="business-name">Nombre comercial</label><input id="business-name" required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de tu negocio"/></div>
          <div className="account-field"><label htmlFor="business-category">Categoría</label><select id="business-category" value={category} onChange={e => setCategory(e.target.value as ProviderProfileInput['category'])}>{providerCategories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="account-field"><label htmlFor="business-neighborhood">Barrio o localidad</label><input id="business-neighborhood" value={neighborhood} onChange={e => setNeighborhood(e.target.value)} required maxLength={120} placeholder="Ej. Malasaña"/></div>
          <div className="account-field full"><label htmlFor="business-description">Descripción (opcional)</label><textarea id="business-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Cuéntanos brevemente qué servicios ofreces."/></div>
          <div className="account-field full"><div className="account-kicker">Enlaces públicos opcionales</div><p className="subtle">Solo se mostrarán en el directorio cuando tu perfil esté aprobado. Usa enlaces HTTPS.</p></div>
          <div className="account-field"><label htmlFor="business-website">Sitio web</label><input id="business-website" type="url" maxLength={500} value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://tusitio.com"/></div>
          <div className="account-field"><label htmlFor="business-instagram">Instagram</label><input id="business-instagram" type="url" maxLength={500} value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/tu-negocio"/></div>
          <div className="account-field"><label htmlFor="business-facebook">Facebook</label><input id="business-facebook" type="url" maxLength={500} value={facebookUrl} onChange={e => setFacebookUrl(e.target.value)} placeholder="https://facebook.com/tu-negocio"/></div>
          <div className="account-field"><label htmlFor="business-whatsapp">WhatsApp</label><input id="business-whatsapp" type="url" maxLength={500} value={whatsappUrl} onChange={e => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/573001234567"/></div>
          <div className="account-form-actions"><button className="account-button" disabled={saveProfile.isPending}>{saveProfile.isPending ? 'Guardando…' : 'Guardar perfil'} <Check size={15}/></button></div>
        </form>
      </section>
      <aside className="account-panel" style={{ background: '#e9eddf', alignSelf: 'start' }}><ShieldCheck size={23}/><h2 className="display" style={{ color: '#285247', margin: '12px 0 8px' }}>Un proceso transparente.</h2><p className="subtle">Después de guardar, el equipo revisará el perfil. El estado cambia desde administración y no puede modificarse desde tu cuenta.</p><div className="notice-box"><CircleHelp size={16}/><span>{profile.data?.approvalStatus === 'approved' ? 'Tu perfil está aprobado y visible para la comunidad.' : profile.data?.approvalStatus === 'suspended' ? 'Tu perfil está suspendido. Contacta con el equipo de PetPulse si necesitas ayuda.' : 'Tu perfil se mostrará como pendiente hasta completar la revisión.'}</span></div></aside>
    </div>}
    {profile.data && !profile.isError && <div className="account-grid two provider-resources-grid">
      <ProviderServicesPanel/>
      <ProviderAvailabilityPanel/>
    </div>}
  </main>;
}
