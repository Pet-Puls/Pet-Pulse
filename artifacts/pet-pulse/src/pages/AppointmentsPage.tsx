import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Check, Clock3, PawPrint, X } from 'lucide-react';
import {
  getGetNotificationPreferencesQueryKey,
  getListAppointmentsQueryKey,
  getListPetsQueryKey,
  getListPublicProvidersQueryKey,
  useActOnAppointment,
  useGetNotificationPreferences,
  useListAppointments,
  useListPets,
  useListPublicProviders,
  useRequestAppointment,
  useSaveNotificationPreferences,
} from '@workspace/api-client-react';
import type {
  Appointment,
  AppointmentActionInputAction,
  MeProfile,
} from '@workspace/api-client-react';
import { ActionLink, ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';

const appointmentStatusLabels: Record<Appointment['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  declined: 'Rechazada',
  cancelled: 'Cancelada',
  reschedule_pending: 'Cambio propuesto',
};

function formatInTimezone(value: string, timezone: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

function dateInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatCop(value: number | null) {
  return value === null
    ? 'Precio por consultar'
    : new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value);
}

export default function AppointmentsPage({ me }: { me: MeProfile }) {
  const client = useQueryClient();
  const canUseAppointments = me.role === 'owner' || me.role === 'provider';
  const appointments = useListAppointments({
    query: {
      enabled: canUseAppointments,
      queryKey: getListAppointmentsQueryKey(),
    },
  });
  const pets = useListPets({
    query: {
      enabled: me.role === 'owner',
      queryKey: getListPetsQueryKey(),
    },
  });
  const preferences = useGetNotificationPreferences({
    query: {
      enabled: canUseAppointments,
      queryKey: getGetNotificationPreferencesQueryKey(),
    },
  });
  const savePreferences = useSaveNotificationPreferences({
    mutation: {
      onSuccess: result => {
        client.setQueryData(getGetNotificationPreferencesQueryKey(), result);
      },
    },
  });
  const request = useRequestAppointment({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
      },
    },
  });
  const action = useActOnAppointment({
    mutation: {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
      },
    },
  });

  const [providerId, setProviderId] = useState(
    () => new URLSearchParams(window.location.search).get('providerId') ?? '',
  );
  const [dateProviderId, setDateProviderId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [petId, setPetId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [preferencesInitialized, setPreferencesInitialized] = useState(false);
  const [reschedule, setReschedule] = useState<{ id: string; date: string; time: string } | null>(null);
  const [notice, setNotice] = useState('');

  const publicProviders = useListPublicProviders(
    { page: 1, pageSize: 50 },
    {
      query: {
        enabled: me.role === 'owner',
        queryKey: getListPublicProvidersQueryKey({ page: 1, pageSize: 50 }),
      },
    },
  );
  const selectedProvider = publicProviders.data?.items.find(provider => provider.id === providerId);
  const services = selectedProvider?.services ?? [];

  useEffect(() => {
    if (!selectedProvider) return;
    if (!services.some(service => service.id === serviceId)) {
      setServiceId(services[0]?.id ?? '');
    }
    if (dateProviderId !== selectedProvider.id) {
      setDate(dateInTimezone(selectedProvider.availability.timezone));
      setDateProviderId(selectedProvider.id);
    }
  }, [selectedProvider, serviceId, services, dateProviderId]);

  useEffect(() => {
    if (!preferences.data || preferencesInitialized) return;
    setPhoneNumber(preferences.data.phoneNumber ?? '');
    setWhatsappOptIn(preferences.data.whatsappOptIn);
    setPreferencesInitialized(true);
  }, [preferences.data, preferencesInitialized]);

  useEffect(() => {
    if (pets.data?.length && !pets.data.some(pet => pet.id === petId)) {
      setPetId(pets.data[0].id);
    }
  }, [pets.data, petId]);

  function submitAppointment(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    if (!selectedProvider || !serviceId || !petId) return;
    request.mutate({
      data: { providerId, serviceId, petId, date, time },
    }, {
      onSuccess: () => {
        setNotice('Tu solicitud quedó pendiente de confirmación. Las actualizaciones también aparecerán aquí.');
        setTime('');
      },
    });
  }

  function saveNotificationPreferences(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    savePreferences.mutate({
      data: {
        phoneNumber: phoneNumber.trim() || null,
        whatsappOptIn,
      },
    }, {
      onSuccess: () => setNotice('Tus preferencias de notificación se guardaron.'),
    });
  }

  function submitAction(appointmentId: string, selectedAction: AppointmentActionInputAction, proposedDate?: string, proposedTime?: string) {
    action.mutate({
      appointmentId,
      data: {
        action: selectedAction,
        ...(proposedDate ? { date: proposedDate } : {}),
        ...(proposedTime ? { time: proposedTime } : {}),
      },
    }, {
      onSuccess: () => {
        if (selectedAction === 'propose_reschedule') setReschedule(null);
      },
    });
  }

  if (!canUseAppointments) {
    return <main className="account-content"><PageHeading kicker="Agenda" title="Citas" subtitle="Esta sección está disponible para tutores y proveedores."/></main>;
  }

  return <main className="account-content">
    <PageHeading
      kicker="Agenda de cuidado"
      title={me.role === 'owner' ? 'Tus citas' : 'Solicitudes de cita'}
      subtitle={me.role === 'owner'
        ? 'Solicita una cita con un proveedor aprobado y gestiona tus horarios.'
        : 'Confirma, rechaza o propone un horario para las solicitudes recibidas.'}
    />

    {notice && <div className="notice-box" role="status" style={{ marginBottom: 16 }}><Check size={17}/>{notice}</div>}
    {request.isError && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{errorMessage(request.error)}</div>}
    {action.isError && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{errorMessage(action.error)}</div>}
    {savePreferences.isError && <div className="error-box" role="alert" style={{ marginBottom: 16 }}>{errorMessage(savePreferences.error)}</div>}

    <div className="appointment-page-grid">
      {me.role === 'owner' && <section className="account-panel">
        <div className="account-kicker">Nueva solicitud</div>
        <h2 className="display appointment-section-title">Solicitar una cita</h2>
        {publicProviders.isLoading || pets.isLoading
          ? <LoadingPanel label="Cargando proveedores y mascotas…"/>
          : publicProviders.isError
            ? <ErrorPanel message={errorMessage(publicProviders.error)} retry={() => void publicProviders.refetch()}/>
            : pets.isError
              ? <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>
              : !pets.data?.length
                ? <div className="empty-box"><PawPrint size={26}/><p>Agrega una mascota antes de solicitar una cita.</p><ActionLink href="/workspace/pets">Gestionar mascotas</ActionLink></div>
                : !publicProviders.data?.items.length
                  ? <p className="subtle">Aún no hay proveedores aprobados con servicios publicados.</p>
                  : <form className="account-form" onSubmit={submitAppointment}>
                    <div className="account-field full">
                      <label htmlFor="appointment-provider">Proveedor</label>
                      <select id="appointment-provider" value={providerId} required onChange={event => {
                        setProviderId(event.target.value);
                        setServiceId('');
                      }}>
                        <option value="">Selecciona un proveedor</option>
                        {publicProviders.data.items.map(provider => <option key={provider.id} value={provider.id}>{provider.name} · {provider.neighborhood}</option>)}
                      </select>
                    </div>
                    <div className="account-field full">
                      <label htmlFor="appointment-service">Servicio</label>
                      <select id="appointment-service" value={serviceId} required disabled={!services.length} onChange={event => setServiceId(event.target.value)}>
                        <option value="">Selecciona un servicio</option>
                        {services.map(service => <option key={service.id} value={service.id}>{service.name} · {service.durationMinutes} min · {formatCop(service.priceCop)}</option>)}
                      </select>
                    </div>
                    <div className="account-field full">
                      <label htmlFor="appointment-pet">Mascota</label>
                      <select id="appointment-pet" value={petId} required onChange={event => setPetId(event.target.value)}>
                        {pets.data.map(pet => <option key={pet.id} value={pet.id}>{pet.name}</option>)}
                      </select>
                    </div>
                    <div className="account-field">
                      <label htmlFor="appointment-date">Fecha local</label>
                      <input id="appointment-date" type="date" value={date} required onChange={event => setDate(event.target.value)}/>
                    </div>
                    <div className="account-field">
                      <label htmlFor="appointment-time">Hora local</label>
                      <input id="appointment-time" type="time" value={time} required onChange={event => setTime(event.target.value)}/>
                    </div>
                    {selectedProvider && <p className="account-form-hint full">Hora del proveedor: {selectedProvider.availability.timezone}. La solicitud se confirmará cuando el proveedor responda.</p>}
                    <div className="account-form-actions">
                      <button className="account-button" disabled={request.isPending || !selectedProvider || !services.length}>
                        {request.isPending ? 'Enviando…' : 'Solicitar cita'} <CalendarClock size={15}/>
                      </button>
                    </div>
                  </form>}
      </section>}

      <section className="account-panel">
        <div className="account-kicker">{me.role === 'owner' ? 'Tu agenda' : 'Bandeja de solicitudes'}</div>
        <h2 className="display appointment-section-title">{me.role === 'owner' ? 'Citas registradas' : 'Citas de tu perfil'}</h2>
        {appointments.isLoading
          ? <LoadingPanel label="Cargando citas…"/>
          : appointments.isError
            ? <ErrorPanel message={errorMessage(appointments.error)} retry={() => void appointments.refetch()}/>
            : appointments.data?.length
              ? <div className="appointment-list">{appointments.data.map(appointment => {
                const isOwner = appointment.ownerId === me.id;
                const canCancel = ['pending', 'confirmed', 'reschedule_pending'].includes(appointment.status) && new Date(appointment.startsAt) > new Date();
                const canPropose = !isOwner && ['pending', 'confirmed'].includes(appointment.status) && new Date(appointment.startsAt) > new Date();
                const proposedTime = appointment.proposedStartsAt
                  ? formatInTimezone(appointment.proposedStartsAt, appointment.timezone)
                  : null;
                return <article className="appointment-card" key={appointment.id}>
                  <div className="appointment-card-heading">
                    <div className="appointment-date-mark"><CalendarClock size={18}/></div>
                    <div className="appointment-card-title">
                      <h3>{appointment.serviceName} · {appointment.petName}</h3>
                      <p>{isOwner ? appointment.providerName : `Tutor de ${appointment.petName}`}</p>
                    </div>
                    <span className={`appointment-status ${appointment.status}`}>{appointmentStatusLabels[appointment.status]}</span>
                  </div>
                  <p className="appointment-time"><Clock3 size={15}/>{formatInTimezone(appointment.startsAt, appointment.timezone)} · {appointment.timezone}</p>
                  {proposedTime && <p className="appointment-proposal">Horario propuesto: <strong>{proposedTime}</strong></p>}
                  <p className="appointment-details">{appointment.durationMinutes} min · {formatCop(appointment.priceCop)}</p>
                  <div className="appointment-actions">
                    {!isOwner && appointment.status === 'pending' && <>
                      {new Date(appointment.startsAt) > new Date() && <button className="account-button tiny" onClick={() => submitAction(appointment.id, 'confirm')} disabled={action.isPending}><Check size={14}/> Confirmar</button>}
                      <button className="account-button outline tiny" onClick={() => submitAction(appointment.id, 'decline')} disabled={action.isPending}><X size={14}/> Rechazar</button>
                    </>}
                    {canPropose && <button className="account-button outline tiny" onClick={() => setReschedule(current => current?.id === appointment.id ? null : { id: appointment.id, date: '', time: '' })}>Proponer otro horario</button>}
                    {isOwner && appointment.status === 'reschedule_pending' && <>
                      <button className="account-button tiny" onClick={() => submitAction(appointment.id, 'accept_reschedule')} disabled={action.isPending}><Check size={14}/> Aceptar horario</button>
                      <button className="account-button outline tiny" onClick={() => submitAction(appointment.id, 'reject_reschedule')} disabled={action.isPending}><X size={14}/> Rechazar horario</button>
                    </>}
                    {canCancel && <button className="account-button outline tiny" onClick={() => submitAction(appointment.id, 'cancel')} disabled={action.isPending}>Cancelar cita</button>}
                  </div>
                  {reschedule?.id === appointment.id && <form className="appointment-reschedule-form" onSubmit={event => {
                    event.preventDefault();
                    submitAction(appointment.id, 'propose_reschedule', reschedule.date, reschedule.time);
                  }}>
                    <label>Fecha <input type="date" value={reschedule.date} required onChange={event => setReschedule({ ...reschedule, date: event.target.value })}/></label>
                    <label>Hora <input type="time" value={reschedule.time} required onChange={event => setReschedule({ ...reschedule, time: event.target.value })}/></label>
                    <button className="account-button tiny" disabled={action.isPending}>Enviar propuesta</button>
                  </form>}
                </article>;
              })}</div>
              : <div className="empty-box"><CalendarClock size={27}/><h3>Aún no hay citas</h3><p>{me.role === 'owner' ? 'Elige un proveedor aprobado para enviar tu primera solicitud.' : 'Las solicitudes nuevas aparecerán en esta lista.'}</p></div>}
      </section>

      <section className="account-panel appointment-preferences">
        <div className="account-kicker">Avisos de agenda</div>
        <h2 className="display appointment-section-title">Preferencias de notificación</h2>
        {preferences.isLoading
          ? <LoadingPanel label="Cargando preferencias…"/>
          : preferences.isError
            ? <ErrorPanel message={errorMessage(preferences.error)} retry={() => void preferences.refetch()}/>
            : <form className="account-form" onSubmit={saveNotificationPreferences}>
              <p className="account-form-hint full">Los avisos de cita se envían al correo verificado de tu cuenta cuando Gmail SMTP esté configurado.</p>
              <div className="account-field full">
                <label htmlFor="notification-phone">Teléfono para WhatsApp (opcional)</label>
                <input id="notification-phone" type="tel" inputMode="tel" maxLength={16} pattern="\+[1-9][0-9]{1,14}" placeholder="+573001234567" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)}/>
                <small>Usa el formato internacional, incluido el signo +.</small>
              </div>
              <label className="appointment-consent full">
                <input type="checkbox" checked={whatsappOptIn} onChange={event => setWhatsappOptIn(event.target.checked)}/>
                <span>Acepto recibir avisos de citas por WhatsApp en el número indicado.</span>
              </label>
              <p className="account-form-hint full">WhatsApp aún no está conectado a un proveedor de envío; con tu permiso, los avisos quedarán en espera y no se enviarán todavía.</p>
              <div className="account-form-actions">
                <button className="account-button" disabled={savePreferences.isPending}>
                  {savePreferences.isPending ? 'Guardando…' : 'Guardar preferencias'} <Check size={15}/>
                </button>
              </div>
            </form>}
      </section>
    </div>
  </main>;
}
