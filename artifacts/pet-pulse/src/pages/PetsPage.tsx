import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check, ImagePlus, PawPrint, Plus, QrCode, Trash2, UserRound, X,
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
}: {
  pet?: PetProfile;
  onClose: () => void;
  onSaved: (input: PetInput, photo?: File) => void;
}) {
  const [name, setName] = useState(pet?.name || '');
  const [species, setSpecies] = useState(pet?.species || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [age, setAge] = useState(pet?.age || '');
  const [contact, setContact] = useState(pet?.emergencyContact || '');
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
      setPhotoError('Elige una imagen JPEG, PNG o WebP.');
      return;
    }
    if (file.size > maxPhotoBytes) {
      setPhotoError('La imagen debe pesar 5 MB o menos.');
      return;
    }
    setPhoto(file);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pet-editor-title"><div className="modal-head"><div><div className="eyebrow">PetPulse · perfil privado</div><h2 className="display" id="pet-editor-title">{pet ? `Editar a ${pet.name}` : 'Nueva mascota'}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={onClose}><X size={17}/></button></div>
    <form className="account-form" onSubmit={e => {
      e.preventDefault();
      onSaved({
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim() || null,
        age: age.trim() || null,
        emergencyContact: contact.trim() || null,
        shareEmergencyContact,
      }, photo);
    }}>
      <label className="pet-photo-picker">
        {previewUrl ? <img src={previewUrl} alt={`Vista previa de ${name || 'la mascota'}`} /> : <span><ImagePlus size={25}/>Añadir foto</span>}
        <input type="file" accept={acceptedPhotoTypes.join(',')} onChange={event => choosePhoto(event.target.files?.[0])}/>
      </label>
      <p className="subtle pet-photo-help">JPEG, PNG o WebP · máximo 5 MB. Se guarda de forma privada.</p>
      {photoError && <p className="error-box" role="alert">{photoError}</p>}
      <div className="account-field"><label htmlFor="pet-name">Nombre</label><input id="pet-name" value={name} required maxLength={100} onChange={e => setName(e.target.value)} autoFocus/></div>
      <div className="account-field"><label htmlFor="pet-species">Especie</label><input id="pet-species" value={species} required maxLength={60} onChange={e => setSpecies(e.target.value)} placeholder="Perro, gato…"/></div>
      <div className="account-field"><label htmlFor="pet-breed">Raza (opcional)</label><input id="pet-breed" value={breed} maxLength={120} onChange={e => setBreed(e.target.value)}/></div>
      <div className="account-field"><label htmlFor="pet-age">Edad (opcional)</label><input id="pet-age" value={age} maxLength={80} onChange={e => setAge(e.target.value)} placeholder="Ej. 4 años"/></div>
      <div className="account-field full"><label htmlFor="pet-emergency">Contacto de emergencia (opcional)</label><input id="pet-emergency" value={contact} maxLength={240} onChange={e => setContact(e.target.value)} placeholder="Teléfono y nombre"/></div>
      <label className="pet-contact-consent"><input type="checkbox" checked={shareEmergencyContact} onChange={event => setShareEmergencyContact(event.target.checked)}/><span><strong>Compartir este contacto en el QR público</strong><small>Solo será visible si activas esta opción. Puedes cambiarla o revocar el QR cuando quieras.</small></span></label>
      <div className="account-form-actions"><button type="button" className="account-button outline" onClick={onClose}>Cancelar</button><button className="account-button" type="submit">Guardar perfil <Check size={15}/></button></div>
    </form>
  </section></div>;
}

function PetQrDialog({ pet, onClose }: { pet: PetProfile; onClose: () => void }) {
  const client = useQueryClient();
  const [token, setToken] = useState('');
  const [failure, setFailure] = useState('');
  const [isLoading, setIsLoading] = useState(true);
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

  async function revoke() {
    setFailure('');
    try {
      await revokePetQr(pet.id);
      await client.invalidateQueries({ queryKey: getListPetsQueryKey() });
      onClose();
    } catch (error) {
      setFailure(errorMessage(error));
    }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal pet-qr-dialog" role="dialog" aria-modal="true" aria-labelledby="pet-qr-title">
      <div className="modal-head"><div><div className="eyebrow">Ficha pública</div><h2 className="display" id="pet-qr-title">QR de {pet.name}</h2></div><button className="icon-button" aria-label="Cerrar QR" onClick={onClose}><X size={17}/></button></div>
      {isLoading ? <LoadingPanel label="Preparando el QR…"/> : failure ? <ErrorPanel message={failure} retry={() => setAttempt(value => value + 1)}/> : <>
        <div className="pet-qr-code"><QRCodeSVG value={publicUrl} size={220} level="M" includeMargin/></div>
        <p className="subtle">Al escanearlo se abre la ficha pública limitada de {pet.name}. No muestra edad, dirección ni datos de la cuenta.</p>
        <a className="text-link" href={publicUrl} target="_blank" rel="noreferrer">Abrir ficha pública</a>
        {pet.shareEmergencyContact && <p className="notice-box">El contacto de emergencia está visible porque lo autorizaste en el perfil.</p>}
      </>}
      {failure && <p className="error-box" role="alert">{failure}</p>}
      {!isLoading && <div className="account-form-actions"><button className="account-button danger tiny" onClick={() => void revoke()}>Revocar QR</button><button className="account-button outline" onClick={onClose}>Cerrar</button></div>}
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

  async function save(input: PetInput, photo?: File) {
    setFailure('');
    setIsSaving(true);
    try {
      const creating = !editing || editing === 'new';
      const savedPet = creating
        ? await createPet.mutateAsync({ data: input })
        : await updatePet.mutateAsync({ petId: editing.id, data: input });
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
    {editing && <PetEditor key={editing === 'new' ? 'new' : editing.id} pet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={(input, photo) => void save(input, photo)}/>}
    {qrPet && <PetQrDialog pet={qrPet} onClose={() => setQrPet(null)}/>}
  </main>;
}
