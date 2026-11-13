import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Clock3, MapPin, PawPrint, Plus, RefreshCw, ShieldCheck, X,
} from 'lucide-react';
import {
  getListLostPetReportsQueryKey, getListPetsQueryKey,
  useCloseLostPetReport, useCreateLostPetReport, useListLostPetReports, useListPets,
  useRenewLostPetReport,
} from '@workspace/api-client-react';
import type { LostPetReport, LostPetReportInput, MeProfile, PetProfile } from '@workspace/api-client-react';
import { ActionLink, ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';

type ReportFormState =
  | { kind: 'create' }
  | { kind: 'renew'; report: LostPetReport };

function localDateTimeValue(value?: string) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function LostPetReportForm({
  pets,
  report,
  onCancel,
  onSubmit,
  saving,
}: {
  pets: PetProfile[];
  report?: LostPetReport;
  onCancel: () => void;
  onSubmit: (petId: string, input: LostPetReportInput) => void;
  saving: boolean;
}) {
  const [petId, setPetId] = useState(report?.petId ?? pets[0]?.id ?? '');
  const [locationDescription, setLocationDescription] = useState(report?.locationDescription ?? '');
  const [lastSeenAt, setLastSeenAt] = useState(localDateTimeValue(report?.lastSeenAt));
  const [notes, setNotes] = useState(report?.notes ?? '');
  const [consent, setConsent] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lastSeenDate = new Date(lastSeenAt);
    if (!petId || !Number.isFinite(lastSeenDate.getTime())) return;
    onSubmit(petId, {
      locationDescription: locationDescription.trim(),
      lastSeenAt: lastSeenDate.toISOString(),
      notes: notes.trim() || null,
      consentToShareLocation: consent,
    });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => {
    if (!saving && event.target === event.currentTarget) onCancel();
  }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="lost-report-title">
      <div className="modal-head">
        <div>
          <div className="eyebrow">Reporte privado a la comunidad</div>
          <h2 className="display" id="lost-report-title">
            {report ? `Renovar búsqueda de ${report.petName}` : 'Reportar mascota perdida'}
          </h2>
        </div>
        <button className="icon-button" aria-label="Cerrar formulario" onClick={onCancel} disabled={saving}><X size={17}/></button>
      </div>
      <form className="account-form" onSubmit={submit}>
        {!report && <div className="account-field full">
          <label htmlFor="lost-pet-select">Mascota</label>
          <select id="lost-pet-select" value={petId} required disabled={saving} onChange={event => setPetId(event.target.value)}>
            {pets.map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
          </select>
        </div>}
        <div className="account-field full">
          <label htmlFor="lost-location">Último barrio o sector aproximado</label>
          <input
            id="lost-location"
            value={locationDescription}
            maxLength={160}
            minLength={2}
            required
            disabled={saving}
            onChange={event => setLocationDescription(event.target.value)}
            placeholder="Ej. Laureles, Medellín"
          />
          <small>No escribas una dirección exacta. No usamos GPS ni rastreamos a la mascota.</small>
        </div>
        <div className="account-field full">
          <label htmlFor="lost-last-seen">¿Cuándo la viste por última vez?</label>
          <input
            id="lost-last-seen"
            type="datetime-local"
            value={lastSeenAt}
            required
            disabled={saving}
            onChange={event => setLastSeenAt(event.target.value)}
          />
        </div>
        <div className="account-field full">
          <label htmlFor="lost-notes">Detalles útiles (opcional)</label>
          <textarea
            id="lost-notes"
            value={notes}
            maxLength={500}
            rows={3}
            disabled={saving}
            onChange={event => setNotes(event.target.value)}
            placeholder="Color, señas particulares u otra información para ayudar a reconocerla."
          />
          <small>No incluyas teléfonos, direcciones exactas ni datos privados.</small>
        </div>
        <label className="pet-contact-consent">
          <input type="checkbox" checked={consent} disabled={saving} onChange={event => setConsent(event.target.checked)}/>
          <span>
            <strong>Autorizo compartir estos datos con miembros de Monka que hayan iniciado sesión.</strong>
            <small>El reporte dura 72 horas. Puedes cerrarlo antes o renovarlo, confirmando nuevamente el consentimiento.</small>
          </span>
        </label>
        <div className="account-form-actions">
          <button type="button" className="account-button outline" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="account-button" type="submit" disabled={saving || !consent || !petId}>
            {saving ? 'Guardando…' : report ? 'Renovar 72 horas' : 'Publicar reporte'} <AlertTriangle size={15}/>
          </button>
        </div>
      </form>
    </section>
  </div>;
}

function ReportCard({
  report,
  busy,
  onClose,
  onRenew,
}: {
  report: LostPetReport;
  busy: boolean;
  onClose: () => void;
  onRenew: () => void;
}) {
  return <article className="account-panel">
    <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
      <span className="pet-mark pet-mark-photo">
        {report.photoUrl ? <img src={report.photoUrl} alt={`Foto de ${report.petName}`}/> : <PawPrint size={22}/>}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="account-kicker">{report.species}{report.breed ? ` · ${report.breed}` : ''}</div>
        <h2 className="display" style={{ margin: '3px 0 8px' }}>{report.petName}</h2>
        <p className="subtle" style={{ margin: 0 }}><MapPin size={14} style={{ verticalAlign: 'middle' }}/> {report.locationDescription}</p>
        {report.notes && <p className="subtle" style={{ margin: '8px 0 0' }}>{report.notes}</p>}
      </div>
      <span className={`provider-status ${report.status === 'active' ? 'approved' : report.status === 'expired' ? 'pending' : 'suspended'}`}>
        {report.status === 'active' ? 'Activa' : report.status === 'expired' ? 'Vencida' : 'Cerrada'}
      </span>
    </div>
    <div className="appointment" style={{ marginTop: 14 }}>
      <Clock3 size={15}/>
      <span>Vista por última vez: {formatDateTime(report.lastSeenAt)}</span>
    </div>
    <p className="subtle" style={{ margin: '8px 0 0' }}>
      {report.status === 'active' ? `Visible hasta ${formatDateTime(report.expiresAt)}.` : `Reporte ${report.status === 'expired' ? 'vencido' : 'cerrado'} · vencía ${formatDateTime(report.expiresAt)}.`}
    </p>
    {report.canManage && <div className="account-form-actions" style={{ justifyContent: 'flex-start' }}>
      {report.status === 'active' && <button className="account-button danger tiny" onClick={onClose} disabled={busy}>Marcar encontrada y cerrar</button>}
      {report.status === 'expired' && <button className="account-button tiny" onClick={onRenew} disabled={busy}><RefreshCw size={13}/> Renovar búsqueda</button>}
    </div>}
  </article>;
}

export default function LostPetsPage({ me }: { me: MeProfile }) {
  const client = useQueryClient();
  const reports = useListLostPetReports({ query: { queryKey: getListLostPetReportsQueryKey() } });
  const pets = useListPets({
    query: { enabled: me.role === 'owner', queryKey: getListPetsQueryKey() },
  });
  const createReport = useCreateLostPetReport();
  const closeReport = useCloseLostPetReport();
  const renewReport = useRenewLostPetReport();
  const [form, setForm] = useState<ReportFormState | null>(null);
  const [failure, setFailure] = useState('');
  const isSaving = createReport.isPending || closeReport.isPending || renewReport.isPending;
  const allReports = reports.data ?? [];
  const ownReports = allReports.filter(report => report.canManage);
  const communityReports = allReports.filter(report => !report.canManage);
  const petsWithoutActiveReport = (pets.data ?? []).filter(pet =>
    !allReports.some(report => report.petId === pet.id && report.status === 'active'),
  );

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: getListLostPetReportsQueryKey() }),
      client.invalidateQueries({ queryKey: getListPetsQueryKey() }),
    ]);
  }

  async function saveReport(petId: string, input: LostPetReportInput) {
    setFailure('');
    try {
      if (form?.kind === 'renew') {
        await renewReport.mutateAsync({ reportId: form.report.id, data: input });
      } else {
        await createReport.mutateAsync({ petId, data: input });
      }
      setForm(null);
      await refresh();
    } catch (error) {
      setFailure(errorMessage(error));
      await refresh();
    }
  }

  async function close(report: LostPetReport) {
    if (!window.confirm(`¿Marcar a ${report.petName} como encontrada y cerrar el reporte?`)) return;
    setFailure('');
    try {
      await closeReport.mutateAsync({ reportId: report.id });
      await refresh();
    } catch (error) {
      setFailure(errorMessage(error));
      await refresh();
    }
  }

  const ownerCanReport = me.role === 'owner' && petsWithoutActiveReport.length > 0;
  return <main className="account-content">
    <PageHeading
      kicker="Apoyo entre miembros"
      title="Mascotas perdidas"
      subtitle="Los reportes y barrios aproximados solo son visibles para miembros que iniciaron sesión. No se comparte ubicación exacta."
      action={ownerCanReport ? <button className="account-button" onClick={() => setForm({ kind: 'create' })}><Plus size={15}/> Crear reporte</button> : undefined}
    />
    <div className="notice-box" role="note"><ShieldCheck size={17}/><span>La ubicación es voluntaria, aproximada y se comparte por 72 horas. El QR público no muestra que exista un reporte.</span></div>
    {failure && <div style={{ marginTop: 14 }}><ErrorPanel message={failure} retry={() => setFailure('')}/></div>}
    {reports.isLoading || (me.role === 'owner' && pets.isLoading) ? <LoadingPanel label="Cargando reportes…"/> : null}
    {reports.isError && <ErrorPanel message={errorMessage(reports.error)} retry={() => void reports.refetch()}/>}
    {me.role === 'owner' && pets.isError && <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>}
    {me.role === 'owner' && !pets.isLoading && !pets.isError && !pets.data?.length && <section className="account-panel empty-box">
      <PawPrint size={28}/><h2 className="display">Primero agrega una mascota</h2>
      <p>Necesitas un perfil para crear un reporte.</p><ActionLink href="/workspace/pets">Ir a mis mascotas</ActionLink>
    </section>}
    {me.role === 'owner' && !pets.isLoading && !pets.isError && pets.data?.length && !petsWithoutActiveReport.length && <section className="account-panel">
      <p className="subtle">Todas tus mascotas ya tienen un reporte activo. Puedes renovarlo o cerrarlo en esta página.</p>
    </section>}
    {!reports.isLoading && !reports.isError && <>
      {me.role === 'owner' && <section>
        <div className="section-row"><h2 className="display">Tus reportes</h2></div>
        {ownReports.length
          ? <div className="account-grid two">{ownReports.map(report => <ReportCard key={report.id} report={report} busy={isSaving} onClose={() => void close(report)} onRenew={() => setForm({ kind: 'renew', report })}/>)}</div>
          : <section className="account-panel empty-box"><AlertTriangle size={27}/><h3>No tienes reportes activos</h3><p>Si necesitas apoyo, puedes publicar un barrio o sector aproximado para miembros de Monka.</p></section>}
      </section>}
      <section style={{ marginTop: 18 }}>
        <div className="section-row"><h2 className="display">Reportes de la comunidad</h2></div>
        {communityReports.length
          ? <div className="account-grid two">{communityReports.map(report => <ReportCard key={report.id} report={report} busy={isSaving} onClose={() => undefined} onRenew={() => undefined}/>)}</div>
          : <section className="account-panel empty-box"><ShieldCheck size={27}/><h3>No hay reportes activos</h3><p>Los nuevos reportes aparecerán aquí mientras estén vigentes.</p></section>}
      </section>
    </>}
    {form && <LostPetReportForm
      pets={form.kind === 'create' ? petsWithoutActiveReport : []}
      report={form.kind === 'renew' ? form.report : undefined}
      onCancel={() => setForm(null)}
      onSubmit={(petId, input) => void saveReport(petId, input)}
      saving={isSaving}
    />}
  </main>;
}
