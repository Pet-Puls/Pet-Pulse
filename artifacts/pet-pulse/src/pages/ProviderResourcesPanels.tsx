import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Clock3, Plus, Save, Trash2 } from 'lucide-react';
import {
  getGetProviderAvailabilityQueryKey,
  getListProviderServicesQueryKey,
  useArchiveProviderService,
  useCreateProviderService,
  useGetProviderAvailability,
  useListProviderServices,
  useSaveProviderAvailability,
  useUpdateProviderService,
} from '@workspace/api-client-react';
import type {
  AvailabilityException,
  ProviderAvailability,
  ProviderService,
  ProviderServiceInput,
  WeeklyAvailabilityWindow,
} from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, errorMessage } from '@/components/app-shared';

const weekdays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
let nextLocalKey = 0;
const localKey = () => `provider-resource-${++nextLocalKey}`;

type EditableWeeklyWindow = WeeklyAvailabilityWindow & { key: string };
type EditableExceptionWindow = AvailabilityException['windows'][number] & { key: string };
type EditableException = Omit<AvailabilityException, 'windows'> & {
  key: string;
  windows: EditableExceptionWindow[];
};

function formatCop(value: number | null) {
  return value === null
    ? 'Consultar precio'
    : new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0,
      }).format(value);
}

function toAvailabilityForm(value: ProviderAvailability): {
  timezone: string;
  weeklyWindows: EditableWeeklyWindow[];
  exceptions: EditableException[];
} {
  return {
    timezone: value.timezone,
    weeklyWindows: value.weeklyWindows.map(window => ({ ...window, key: localKey() })),
    exceptions: value.exceptions.map(exception => ({
      ...exception,
      key: localKey(),
      windows: exception.windows.map(window => ({ ...window, key: localKey() })),
    })),
  };
}

export function ProviderServicesPanel() {
  const client = useQueryClient();
  const services = useListProviderServices();
  const create = useCreateProviderService();
  const update = useUpdateProviderService();
  const archive = useArchiveProviderService();
  const [editing, setEditing] = useState<ProviderService | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [priceCop, setPriceCop] = useState('');
  const [notice, setNotice] = useState('');
  const pending = create.isPending || update.isPending || archive.isPending;

  function resetForm() {
    setEditing(null);
    setName('');
    setDescription('');
    setDurationMinutes('45');
    setPriceCop('');
  }

  function beginEdit(service: ProviderService) {
    setEditing(service);
    setName(service.name);
    setDescription(service.description ?? '');
    setDurationMinutes(String(service.durationMinutes));
    setPriceCop(service.priceCop === null ? '' : String(service.priceCop));
    setNotice('');
  }

  function refreshServices() {
    void client.invalidateQueries({ queryKey: getListProviderServicesQueryKey() });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    const duration = Number(durationMinutes);
    const price = priceCop.trim() === '' ? null : Number(priceCop);
    if (
      !Number.isInteger(duration) ||
      duration < 5 ||
      duration > 480 ||
      (price !== null &&
        (!Number.isSafeInteger(price) || price < 0 || price > 2147483647))
    ) {
      setNotice('Revisa la duración (5–480 minutos) y la tarifa en COP.');
      return;
    }

    const data: ProviderServiceInput = {
      name: name.trim(),
      description: description.trim() || null,
      durationMinutes: duration,
      priceCop: price,
    };
    if (editing) {
      update.mutate(
        { serviceId: editing.id, data },
        {
          onSuccess: () => {
            refreshServices();
            resetForm();
            setNotice('Servicio actualizado.');
          },
        },
      );
    } else {
      create.mutate(
        { data },
        {
          onSuccess: () => {
            refreshServices();
            resetForm();
            setNotice('Servicio agregado.');
          },
        },
      );
    }
  }

  function toggleService(service: ProviderService) {
    if (service.isActive) {
      archive.mutate(
        { serviceId: service.id },
        {
          onSuccess: () => {
            refreshServices();
            setNotice('Servicio archivado. Ya no aparecerá en el directorio.');
          },
        },
      );
      return;
    }
    update.mutate(
      { serviceId: service.id, data: { isActive: true } },
      {
        onSuccess: () => {
          refreshServices();
          setNotice('Servicio activado.');
        },
      },
    );
  }

  const mutationError = create.error ?? update.error ?? archive.error;

  return (
    <section className="account-panel provider-resources-panel">
      <div className="provider-resources-heading">
        <div>
          <div className="account-kicker">Catálogo</div>
          <h2 className="display">Servicios</h2>
        </div>
        <Clock3 size={20} aria-hidden="true" />
      </div>
      <p className="subtle">
        Indica la duración necesaria para organizar futuras citas. Deja la tarifa vacía para mostrar “Consultar precio”.
      </p>
      {services.isLoading && <LoadingPanel label="Cargando servicios…"/>}
      {services.isError && <ErrorPanel message={errorMessage(services.error)} retry={() => void services.refetch()}/>}
      {mutationError && <div className="error-box" role="alert">{errorMessage(mutationError)}</div>}
      {notice && <div className="notice-box" role="status">{notice}</div>}
      {!services.isLoading && !services.isError && (
        <div className="provider-service-list">
          {services.data?.length ? services.data.map(service => (
            <article className={`provider-service-row${service.isActive ? '' : ' inactive'}`} key={service.id}>
              <div>
                <h3>{service.name}</h3>
                <p>{service.durationMinutes} min · {formatCop(service.priceCop)}</p>
                {service.description && <p className="provider-service-description">{service.description}</p>}
                {!service.isActive && <span className="provider-service-status">Archivado</span>}
              </div>
              <div className="provider-resource-actions">
                <button className="account-button outline" type="button" onClick={() => beginEdit(service)} disabled={pending}>
                  Editar
                </button>
                <button className="account-button outline" type="button" onClick={() => toggleService(service)} disabled={pending}>
                  {service.isActive ? <><Archive size={14}/> Archivar</> : 'Activar'}
                </button>
              </div>
            </article>
          )) : <p className="subtle">Aún no has agregado servicios.</p>}
        </div>
      )}
      <form className="account-form provider-resource-form" onSubmit={submit}>
        <div className="account-field full">
          <label htmlFor="provider-service-name">{editing ? 'Editar servicio' : 'Nombre del servicio'}</label>
          <input
            id="provider-service-name"
            required
            minLength={1}
            maxLength={120}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Ej. Consulta veterinaria"
          />
        </div>
        <div className="account-field">
          <label htmlFor="provider-service-duration">Duración (minutos)</label>
          <input
            id="provider-service-duration"
            type="number"
            required
            min={5}
            max={480}
            step={1}
            value={durationMinutes}
            onChange={event => setDurationMinutes(event.target.value)}
          />
        </div>
        <div className="account-field">
          <label htmlFor="provider-service-price">Tarifa fija en COP (opcional)</label>
          <input
            id="provider-service-price"
            type="number"
            min={0}
            max={2147483647}
            step={1}
            value={priceCop}
            onChange={event => setPriceCop(event.target.value)}
            placeholder="Vacío = consultar precio"
          />
        </div>
        <div className="account-field full">
          <label htmlFor="provider-service-description">Descripción (opcional)</label>
          <textarea
            id="provider-service-description"
            maxLength={500}
            value={description}
            onChange={event => setDescription(event.target.value)}
          />
        </div>
        <div className="account-form-actions">
          {editing && <button className="account-button outline" type="button" onClick={resetForm} disabled={pending}>Cancelar</button>}
          <button className="account-button" type="submit" disabled={pending}>
            {pending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar servicio'} <Save size={15}/>
          </button>
        </div>
      </form>
      <p className="provider-resource-footnote">
        Los servicios solo serán públicos cuando el perfil comercial esté aprobado y el servicio esté activo.
      </p>
    </section>
  );
}

export function ProviderAvailabilityPanel() {
  const client = useQueryClient();
  const availability = useGetProviderAvailability();
  const save = useSaveProviderAvailability();
  const [timezone, setTimezone] = useState('America/Bogota');
  const [weeklyWindows, setWeeklyWindows] = useState<EditableWeeklyWindow[]>([]);
  const [exceptions, setExceptions] = useState<EditableException[]>([]);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!availability.data) return;
    const form = toAvailabilityForm(availability.data);
    setTimezone(form.timezone);
    setWeeklyWindows(form.weeklyWindows);
    setExceptions(form.exceptions);
  }, [availability.data]);

  function saveSchedule(event: FormEvent) {
    event.preventDefault();
    setNotice('');
    if (exceptions.some(exception => !exception.date)) {
      setNotice('Completa la fecha de cada excepción.');
      return;
    }
    const data: ProviderAvailability = {
      timezone: timezone.trim(),
      weeklyWindows: weeklyWindows.map(({ key: _key, ...window }) => window),
      exceptions: exceptions.map(({ key: _key, ...exception }) => ({
        ...exception,
        windows: exception.windows.map(({ key: _windowKey, ...window }) => window),
      })),
    };
    save.mutate(
      { data },
      {
        onSuccess: result => {
          client.setQueryData(getGetProviderAvailabilityQueryKey(), result);
          void client.invalidateQueries({ queryKey: getGetProviderAvailabilityQueryKey() });
          setNotice('Disponibilidad guardada.');
        },
      },
    );
  }

  function addWeeklyWindow() {
    setWeeklyWindows(current => [
      ...current,
      { key: localKey(), dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
    ]);
  }

  function updateWeeklyWindow(
    key: string,
    field: keyof WeeklyAvailabilityWindow,
    value: string,
  ) {
    setWeeklyWindows(current => current.map(window => window.key !== key
      ? window
      : { ...window, [field]: field === 'dayOfWeek' ? Number(value) : value }));
  }

  function addException() {
    setExceptions(current => [
      ...current,
      { key: localKey(), date: '', isClosed: true, windows: [] },
    ]);
  }

  function updateException(key: string, patch: Partial<EditableException>) {
    setExceptions(current => current.map(exception =>
      exception.key === key ? { ...exception, ...patch } : exception,
    ));
  }

  function toggleExceptionClosed(exception: EditableException) {
    updateException(exception.key, {
      isClosed: !exception.isClosed,
      windows: exception.isClosed
        ? [{ key: localKey(), startTime: '09:00', endTime: '17:00' }]
        : [],
    });
  }

  function updateExceptionWindow(
    exceptionKey: string,
    windowKey: string,
    field: 'startTime' | 'endTime',
    value: string,
  ) {
    setExceptions(current => current.map(exception => exception.key !== exceptionKey
      ? exception
      : {
          ...exception,
          windows: exception.windows.map(window => window.key === windowKey
            ? { ...window, [field]: value }
            : window),
        }));
  }

  function addExceptionWindow(exception: EditableException) {
    updateException(exception.key, {
      windows: [
        ...exception.windows,
        { key: localKey(), startTime: '09:00', endTime: '17:00' },
      ],
    });
  }

  const removeWeeklyWindow = (key: string) => {
    setWeeklyWindows(current => current.filter(window => window.key !== key));
  };
  const removeException = (key: string) => {
    setExceptions(current => current.filter(exception => exception.key !== key));
  };
  const mutationError = save.error;

  return (
    <section className="account-panel provider-resources-panel">
      <div className="provider-resources-heading">
        <div>
          <div className="account-kicker">Agenda</div>
          <h2 className="display">Disponibilidad</h2>
        </div>
        <Clock3 size={20} aria-hidden="true" />
      </div>
      <p className="subtle">
        Configura tramos semanales recurrentes y fechas que cierran o reemplazan ese horario.
      </p>
      {availability.isLoading && <LoadingPanel label="Cargando disponibilidad…"/>}
      {availability.isError && <ErrorPanel message={errorMessage(availability.error)} retry={() => void availability.refetch()}/>}
      {mutationError && <div className="error-box" role="alert">{errorMessage(mutationError)}</div>}
      {notice && <div className="notice-box" role="status">{notice}</div>}
      {!availability.isLoading && !availability.isError && (
        <form className="provider-availability-form" onSubmit={saveSchedule}>
          <div className="account-field">
            <label htmlFor="provider-timezone">Zona horaria IANA</label>
            <input
              id="provider-timezone"
              required
              maxLength={100}
              value={timezone}
              onChange={event => setTimezone(event.target.value)}
            />
            <span className="provider-resource-footnote">Ejemplo: America/Bogota</span>
          </div>
          <div className="provider-schedule-group">
            <div className="provider-schedule-group-heading">
              <h3>Horario semanal</h3>
              <button className="account-button outline" type="button" onClick={addWeeklyWindow}>
                <Plus size={14}/> Agregar tramo
              </button>
            </div>
            {weeklyWindows.length === 0 && <p className="subtle">Aún no hay horas semanales publicables.</p>}
            {weeklyWindows.map((window, index) => (
              <div className="provider-window-row" key={window.key}>
                <label className="sr-only" htmlFor={`weekly-day-${window.key}`}>Día del tramo {index + 1}</label>
                <select
                  id={`weekly-day-${window.key}`}
                  value={window.dayOfWeek}
                  onChange={event => updateWeeklyWindow(window.key, 'dayOfWeek', event.target.value)}
                >
                  {weekdays.map((day, dayIndex) => <option value={dayIndex} key={day}>{day}</option>)}
                </select>
                <label className="sr-only" htmlFor={`weekly-start-${window.key}`}>Inicio del tramo {index + 1}</label>
                <input
                  id={`weekly-start-${window.key}`}
                  type="time"
                  value={window.startTime}
                  onChange={event => updateWeeklyWindow(window.key, 'startTime', event.target.value)}
                />
                <span aria-hidden="true">a</span>
                <label className="sr-only" htmlFor={`weekly-end-${window.key}`}>Fin del tramo {index + 1}</label>
                <input
                  id={`weekly-end-${window.key}`}
                  type="time"
                  value={window.endTime}
                  onChange={event => updateWeeklyWindow(window.key, 'endTime', event.target.value)}
                />
                <button className="icon-button" type="button" aria-label="Eliminar tramo" onClick={() => removeWeeklyWindow(window.key)}>
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>
          <div className="provider-schedule-group">
            <div className="provider-schedule-group-heading">
              <h3>Excepciones por fecha</h3>
              <button className="account-button outline" type="button" onClick={addException}>
                <Plus size={14}/> Agregar fecha
              </button>
            </div>
            {exceptions.length === 0 && <p className="subtle">No hay cierres o cambios de horario por fecha.</p>}
            {exceptions.map((exception, index) => (
              <article className="provider-exception-row" key={exception.key}>
                <div className="provider-exception-heading">
                  <label htmlFor={`exception-date-${exception.key}`}>Fecha {index + 1}</label>
                  <button className="icon-button" type="button" aria-label="Eliminar excepción" onClick={() => removeException(exception.key)}>
                    <Trash2 size={15}/>
                  </button>
                </div>
                <input
                  id={`exception-date-${exception.key}`}
                  type="date"
                  required
                  value={exception.date}
                  onChange={event => updateException(exception.key, { date: event.target.value })}
                />
                <label className="provider-closed-toggle">
                  <input
                    type="checkbox"
                    checked={exception.isClosed}
                    onChange={() => toggleExceptionClosed(exception)}
                  />
                  Cerrado todo el día
                </label>
                {!exception.isClosed && exception.windows.map((window, windowIndex) => (
                  <div className="provider-window-row" key={window.key}>
                    <label className="sr-only" htmlFor={`exception-start-${window.key}`}>Inicio de tramo {windowIndex + 1}</label>
                    <input
                      id={`exception-start-${window.key}`}
                      type="time"
                      value={window.startTime}
                      onChange={event => updateExceptionWindow(exception.key, window.key, 'startTime', event.target.value)}
                    />
                    <span aria-hidden="true">a</span>
                    <label className="sr-only" htmlFor={`exception-end-${window.key}`}>Fin de tramo {windowIndex + 1}</label>
                    <input
                      id={`exception-end-${window.key}`}
                      type="time"
                      value={window.endTime}
                      onChange={event => updateExceptionWindow(exception.key, window.key, 'endTime', event.target.value)}
                    />
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Eliminar tramo de excepción"
                      onClick={() => updateException(exception.key, {
                        windows: exception.windows.filter(item => item.key !== window.key),
                      })}
                    >
                      <Trash2 size={15}/>
                    </button>
                  </div>
                ))}
                {!exception.isClosed && (
                  <button className="account-button outline provider-add-period" type="button" onClick={() => addExceptionWindow(exception)}>
                    <Plus size={14}/> Agregar tramo
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="account-form-actions">
            <button className="account-button" type="submit" disabled={save.isPending}>
              {save.isPending ? 'Guardando…' : 'Guardar disponibilidad'} <Save size={15}/>
            </button>
          </div>
        </form>
      )}
      <p className="provider-resource-footnote">
        La disponibilidad se interpreta en la zona horaria configurada. Los horarios públicos aparecen solo con el perfil aprobado.
      </p>
    </section>
  );
}
