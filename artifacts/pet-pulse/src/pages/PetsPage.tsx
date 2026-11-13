import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check, Clipboard, Download, ImagePlus, PawPrint, Plus, QrCode, Share2, Trash2, UserRound, X,
} from 'lucide-react';
import {
  createPetQr, getListPetsQueryKey, revokePetQr, uploadPetPhoto,
  useCreatePet, useDeletePet, useListPets, useUpdatePet,
} from '@workspace/api-client-react';
import type { PetInput, PetProfile } from '@workspace/api-client-react';
import { basePath } from '@/app/config';
import { ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';
import { PetSummary } from './WorkspaceHomePage';

const acceptedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxPhotoBytes = 5 * 1024 * 1024;

function PetEditor({
  pet,
  onClose,
  onSaved,
  saving,
}: {
  pet?: PetProfile;
  onClose: () => void;
  onSaved: (input: PetInput, photo: File | undefined, status: PetProfile['status']) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(pet?.name || '');
  const [species, setSpecies] = useState(pet?.species || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [age, setAge] = useState(pet?.age || '');
  const [contact, setContact] = useState(pet?.emergencyContact || '');
  const [status, setStatus] = useState<PetProfile['status']>(pet?.status ?? 'home');
  const [shareEmergencyContact, setShareEmergencyContact] = useState(pet?.shareEmergencyContact || false);
  const [photo, setPhoto] = useState<File>();
  const [photoError, setPhotoError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(pet?.photoUrl ?? null);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl(pet?.photoUrl ?? null);
      return;
    }
    const objectUrl = URL.createObjectURL(photo);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo, pet?.photoUrl]);

  function choosePhoto(file?: File) {
    setPhotoError('');
    if (!file) return;
    if (!acceptedPhotoTypes.includes(file.type)) {
      setPhoto(undefined);
      setPhotoError('Elige una imagen JPEG, PNG o WebP.');
      return;
    }
    if (file.size > maxPhotoBytes) {
      setPhoto(undefined);
      setPhotoError('La imagen debe pesar 5 MB o menos.');
      return;
    }
    setPhoto(file);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (!saving && e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pet-editor-title"><div className="modal-head"><div><div className="eyebrow">PetPulse · perfil privado</div><h2 className="display" id="pet-editor-title">{pet ? `Editar a ${pet.name}` : 'Nueva mascota'}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={onClose} disabled={saving}><X size={17}/></button></div>
    <form className="account-form" onSubmit={e => {
      e.preventDefault();
      onSaved({
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim() || null,
        age: age.trim() || null,
        emergencyContact: contact.trim() || null,
        shareEmergencyContact,
      }, photo, status);
    }}>
      <label className="pet-photo-picker">
        {previewUrl ? <img src={previewUrl} alt={`Vista previa de ${name || 'la mascota'}`} /> : <span><ImagePlus size={25}/>Añadir foto</span>}
        <input type="file" accept={acceptedPhotoTypes.join(',')} disabled={saving} onChange={event => choosePhoto(event.target.files?.[0])}/>
      </label>
      <p className="subtle pet-photo-help">JPEG, PNG o WebP · máximo 5 MB. Se guarda de forma privada.</p>
      {photoError && <p className="error-box" role="alert">{photoError}</p>}
      <div className="account-field"><label htmlFor="pet-name">Nombre</label><input id="pet-name" value={name} required maxLength={100} disabled={saving} onChange={e => setName(e.target.value)} autoFocus/></div>
      <div className="account-field"><label htmlFor="pet-species">Especie</label><input id="pet-species" value={species} required maxLength={60} disabled={saving} onChange={e => setSpecies(e.target.value)} placeholder="Perro, gato…"/></div>
      <div className="account-field"><label htmlFor="pet-breed">Raza (opcional)</label><input id="pet-breed" value={breed} maxLength={120} disabled={saving} onChange={e => setBreed(e.target.value)}/></div>
      <div className="account-field"><label htmlFor="pet-age">Edad (opcional)</label><input id="pet-age" value={age} maxLength={80} disabled={saving} onChange={e => setAge(e.target.value)} placeholder="Ej. 4 años"/></div>
      {pet && <div className="account-field"><label htmlFor="pet-status">Estado actual</label><select id="pet-status" value={status} disabled={saving} onChange={e => setStatus(e.target.value as PetProfile['status'])}><option value="home">En casa</option><option value="walking">De paseo</option><option value="lost">Perdida</option></select></div>}
      <div className="account-field full"><label htmlFor="pet-emergency">Contacto de emergencia (opcional)</label><input id="pet-emergency" value={contact} maxLength={240} disabled={saving} onChange={e => setContact(e.target.value)} placeholder="Teléfono y nombre"/></div>
      <label className="pet-contact-consent"><input type="checkbox" checked={shareEmergencyContact} disabled={saving} onChange={event => setShareEmergencyContact(event.target.checked)}/><span><strong>Compartir este contacto en el QR público</strong><small>Solo será visible si activas esta opción. Puedes cambiarla o revocar el QR cuando quieras.</small></span></label>
      <div className="account-form-actions"><button type="button" className="account-button outline" onClick={onClose} disabled={saving}>Cancelar</button><button className="account-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar perfil'} <Check size={15}/></button></div>
    </form>
  </section></div>;
}

function PetQrDialog({ pet, onClose }: { pet: PetProfile; onClose: () => void }) {
  const client = useQueryClient();
  const dialogRef = useRef<HTMLElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const [failure, setFailure] = useState('');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRevoking, setIsRevoking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const publicUrl = token
    ? new URL(`${basePath}/pet/${token}`, window.location.origin).toString()
    : '';

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setFailure('');
    createPetQr(pet.id).then(result => {
      if (active) setToken(result.token);
    }).catch(error => {
      if (active) setFailure(errorMessage(error));
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [pet.id, attempt]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const closeButton = dialogRef.current?.querySelector<HTMLButtonElement>('[data-qr-close]');
    closeButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  async function shareLink() {
    setActionError('');
    setFeedback('');
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Ficha de ${pet.name} en PetPulse`,
          text: `Ficha pública de ${pet.name}`,
          url: publicUrl,
        });
        setFeedback('Enlace compartido.');
      } else {
        await navigator.clipboard.writeText(publicUrl);
        setFeedback('Enlace copiado. Ya puedes compartirlo.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setActionError(errorMessage(error));
    }
  }

  function downloadQr() {
    setActionError('');
    setFeedback('');
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) {
      setActionError('No pudimos preparar el QR para descargar. Intenta de nuevo.');
      return;
    }

    const safeName = pet.name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'mascota';
    const objectUrl = URL.createObjectURL(new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${safeName}-petpulse-qr.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setFeedback('QR descargado. Puedes imprimirlo o guardarlo.');
  }

  async function revoke() {
    setFailure('');
    setIsRevoking(true);
    try {
      await revokePetQr(pet.id);
      await client.invalidateQueries({ queryKey: getListPetsQueryKey() });
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
      setIsRevoking(false);
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="modal pet-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-qr-title">
      <div className="modal-head"><div><div className="eyebrow">Ficha pública</div><h2 className="display" id="pet-qr-title">QR de {pet.name}</h2></div><button className="icon-button" data-qr-close aria-label="Cerrar QR" onClick={onClose}><X size={17}/></button></div>
      {isLoading ? <LoadingPanel label="Preparando el QR…"/> : failure ? <ErrorPanel message={failure} retry={() => setAttempt(value => value + 1)}/> : <>
        <div ref={qrRef} className="pet-qr-code"><QRCodeSVG value={publicUrl} size={220} level="M" includeMargin/></div>
        <p className="subtle">Al escanearlo se abre la ficha pública limitada de {pet.name}. No muestra edad, dirección ni datos de la cuenta.</p>
        <a className="text-link" href={publicUrl} target="_blank" rel="noreferrer">Abrir ficha pública</a>
        {pet.shareEmergencyContact && pet.emergencyContact && <p className="notice-box">El contacto de emergencia está visible porque lo autorizaste en el perfil.</p>}
        <div className="pet-qr-share-actions">
          <button className="account-button outline tiny" onClick={() => void shareLink()}>{typeof navigator.share === 'function' ? <><Share2 size={14}/> Compartir enlace</> : <><Clipboard size={14}/> Copiar enlace</>}</button>
          <button className="account-button outline tiny" onClick={downloadQr}><Download size={14}/> Descargar QR</button>
        </div>
        {feedback && <p className="subtle" role="status">{feedback}</p>}
        {actionError && <p className="error-box" role="alert">{actionError}</p>}
      </>}
      {!isLoading && <div className="account-form-actions"><button className="account-button danger tiny" onClick={() => void revoke()} disabled={isRevoking}>{isRevoking ? 'Revocando…' : 'Revocar QR'}</button><button className="account-button outline" onClick={onClose}>Cerrar</button></div>}
    </section>
  </div>;
}

export default function PetsPage() {
  const client = useQueryClient();
  const pets = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createPet = useCreatePet();
  const updatePet = useUpdatePet();
  const deletePet = useDeletePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const [editing, setEditing] = useState<PetProfile | null | 'new'>(null);
  const [qrPet, setQrPet] = useState<PetProfile | null>(null);
  const [failure, setFailure] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const closeQr = useCallback(() => setQrPet(null), []);

  async function save(input: PetInput, photo: File | undefined, status: PetProfile['status']) {
    setFailure('');
    setIsSaving(true);
    try {
      const creating = !editing || editing === 'new';
      const savedPet = creating
        ? await createPet.mutateAsync({ data: input })
        : await updatePet.mutateAsync({ petId: editing.id, data: { ...input, status } });
      if (creating) setEditing(savedPet);
      if (photo) {
        await uploadPetPhoto(savedPet.id, photo, { headers: { 'Content-Type': photo.type } });
      }
      await client.invalidateQueries({ queryKey: getListPetsQueryKey() });
      setEditing(null);
    } catch (error) {
      setFailure(errorMessage(error));
      await client.invalidateQueries({ queryKey: getListPetsQueryKey() });
    } finally {
      setIsSaving(false);
    }
  }

  const loadingPets = pets.isLoading || isSaving || deletePet.isPending;
  return <main className="account-content"><PageHeading kicker="Su identidad, siempre a mano" title="Mis mascotas" subtitle="Perfiles privados y persistentes para guardar lo esencial de su cuidado." action={<button className="account-button" onClick={() => setEditing('new')}><Plus size={15}/> Añadir mascota</button>}/>
    {failure && <div style={{ marginBottom: 14 }}><ErrorPanel message={failure} retry={() => setFailure('')}/></div>}
    {loadingPets && <LoadingPanel label={isSaving ? 'Guardando perfil y fotografía…' : deletePet.isPending ? 'Eliminando perfil…' : 'Cargando perfiles…'}/>}
    {pets.isError && <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>}
    {pets.data?.length ? <div className="account-grid two">{pets.data.map(pet => <article key={pet.id} className="account-panel pet-profile-card">
      <PetSummary pet={pet}/>
      <div className="pet-profile-actions">
        <button className="account-button outline tiny" onClick={() => setEditing(pet)}><UserRound size={13}/> Editar</button>
        <button className="account-button outline tiny" onClick={() => setQrPet(pet)}><QrCode size={13}/>{pet.qrEnabled ? 'Ver QR' : 'Crear QR'}</button>
        <button className="account-button danger tiny" onClick={() => { if (window.confirm(`¿Eliminar el perfil de ${pet.name}? Esta acción no se puede deshacer.`)) deletePet.mutate({ petId: pet.id }, { onError: error => setFailure(errorMessage(error)) }); }} aria-label={`Eliminar a ${pet.name}`}><Trash2 size={13}/> Eliminar</button>
      </div>
    </article>)}</div> : null}
    {!pets.isLoading && !pets.isError && !pets.data?.length && <section className="account-panel empty-box"><PawPrint size={30}/><h3>Un perfil para cada historia</h3><p>Aún no has añadido mascotas. Empieza con la información que te gustaría tener siempre a mano.</p><button className="account-button" onClick={() => setEditing('new')}><Plus size={14}/> Crear primer perfil</button></section>}
    {editing && <PetEditor key={editing === 'new' ? 'new' : editing.id} pet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(input, photo, status) => void save(input, photo, status)} saving={isSaving}/>}
    {qrPet && <PetQrDialog pet={qrPet} onClose={closeQr}/>}
  </main>;
}
