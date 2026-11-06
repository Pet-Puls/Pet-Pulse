import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, Building2, Check, ClipboardList, MapPin, PawPrint, Users, X } from 'lucide-react';
import {
  getGetAdminOverviewQueryKey, getListAdminProvidersQueryKey, useGetAdminOverview,
  useListAdminProviders, useUpdateProviderApproval,
} from '@workspace/api-client-react';
import type { ProviderProfile } from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';
import { providerCategories } from './ProviderPage';

export default function AdminPage() {
  const client = useQueryClient();
  const overview = useGetAdminOverview({ query: { queryKey: getGetAdminOverviewQueryKey() } });
  const [filter, setFilter] = useState<'pending' | 'approved' | 'suspended'>('pending');
  const providers = useListAdminProviders({ status: filter }, { query: { queryKey: getListAdminProvidersQueryKey({ status: filter }) } });
  const updateApproval = useUpdateProviderApproval({ mutation: { onSuccess: () => {
    void client.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    void client.invalidateQueries({ queryKey: getListAdminProvidersQueryKey() });
  } } });
  const setStatus = (profile: ProviderProfile, approvalStatus: 'approved' | 'suspended') => updateApproval.mutate({ providerId: profile.id, data: { approvalStatus } });

  return <main className="account-content"><PageHeading kicker="Acceso de administración" title="Revisión de proveedores" subtitle="Métricas y decisiones de estado autorizadas por el servidor."/>
    {overview.isLoading ? <div className="account-grid four"><LoadingPanel/><LoadingPanel/><LoadingPanel/><LoadingPanel/></div> : overview.isError ? <ErrorPanel message={errorMessage(overview.error)} retry={() => void overview.refetch()}/> : <div className="account-grid four">{[
      ['Cuentas', overview.data?.accounts ?? 0, Users],
      ['Mascotas', overview.data?.pets ?? 0, PawPrint],
      ['Perfiles', overview.data?.providerProfiles ?? 0, Building2],
      ['Pendientes', overview.data?.pendingProviders ?? 0, Activity],
    ].map(([label, value, Icon]) => { const I = Icon as typeof Users; return <section className="account-panel account-stat" key={String(label)}><div className="account-stat-label">{String(label)} <span className="pet-mark" style={{ width: 32, height: 32 }}><I size={16}/></span></div><div className="account-stat-value">{String(value)}</div><div className="account-stat-note">Cifras del servidor</div></section>; })}</div>}
    <section className="account-panel" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}><div><div className="account-kicker">Control de acceso</div><h2 className="display" style={{ margin: '7px 0 0', color: '#285247' }}>Perfiles comerciales</h2></div><label className="account-field"><span className="sr-only">Filtrar por estado</span><select aria-label="Filtrar perfiles por estado" className="field" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="pending">Pendientes</option><option value="approved">Aprobados</option><option value="suspended">Suspendidos</option></select></label></div>
      {updateApproval.isError && <div className="error-box" style={{ marginBottom: 12 }} role="alert">{errorMessage(updateApproval.error)}</div>}
      {providers.isLoading ? <LoadingPanel label="Cargando solicitudes…"/> : providers.isError ? <ErrorPanel message={errorMessage(providers.error)} retry={() => void providers.refetch()}/> :
        providers.data?.length ? providers.data.map(profile => <article key={profile.id} className="admin-row">
          <div><h3>{profile.name}</h3><p><MapPin size={12} style={{ verticalAlign: 'middle' }}/> {profile.neighborhood} · {providerCategories.find(([key]) => key === profile.category)?.[1] || profile.category}</p>{profile.description && <p>{profile.description}</p>}<span className={`provider-status ${profile.approvalStatus}`}>{profile.approvalStatus === 'approved' ? 'Aprobado' : profile.approvalStatus === 'suspended' ? 'Suspendido' : 'Pendiente'}</span></div>
          <div className="admin-actions">{filter !== 'approved' && <button className="account-button tiny" disabled={updateApproval.isPending} onClick={() => setStatus(profile, 'approved')}><Check size={13}/> Aprobar</button>}{filter !== 'suspended' && <button className="account-button danger tiny" disabled={updateApproval.isPending} onClick={() => setStatus(profile, 'suspended')}><X size={13}/> Suspender</button>}</div>
        </article>) : <div className="empty-box"><ClipboardList size={28}/><h3>No hay perfiles {filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobados' : 'suspendidos'}</h3><p>Cuando haya perfiles en este estado, aparecerán aquí.</p></div>}
    </section>
  </main>;
}
