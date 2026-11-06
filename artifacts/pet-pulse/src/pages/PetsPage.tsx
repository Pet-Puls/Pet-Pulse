import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, PawPrint, Plus, Trash2, UserRound, X } from 'lucide-react';
import {
  getListPetsQueryKey, useCreatePet, useDeletePet, useListPets, useUpdatePet,
} from '@workspace/api-client-react';
import type { PetInput, PetProfile } from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, PageHeading, errorMessage } from '@/components/app-shared';
import { PetSummary } from './WorkspaceHomePage';

function PetEditor({ pet, onClose, onSaved }: { pet?: PetProfile; onClose: () => void; onSaved: (input: PetInput) => void }) {
  const [name, setName] = useState(pet?.name || '');
  const [species, setSpecies] = useState(pet?.species || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [age, setAge] = useState(pet?.age || '');
  const [contact, setContact] = useState(pet?.emergencyContact || '');

  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="pet-editor-title"><div className="modal-head"><div><div className="eyebrow">PetPulse · perfil privado</div><h2 className="display" id="pet-editor-title">{pet ? `Editar a ${pet.name}` : 'Nueva mascota'}</h2></div><button className="icon-button" aria-label="Cerrar formulario" onClick={onClose}><X size={17}/></button></div>
    <form className="account-form" onSubmit={e => { e.preventDefault(); onSaved({ name: name.trim(), species: species.trim(), breed: breed.trim() || null, age: age.trim() || null, emergencyContact: contact.trim() || null }); }}>
      <div className="account-field"><label htmlFor="pet-name">Nombre</label><input id="pet-name" value={name} required maxLength={100} onChange={e => setName(e.target.value)} autoFocus/></div>
      <div className="account-field"><label htmlFor="pet-species">Especie</label><input id="pet-species" value={species} required maxLength={60} onChange={e => setSpecies(e.target.value)} placeholder="Perro, gato…"/></div>
      <div className="account-field"><label htmlFor="pet-breed">Raza (opcional)</label><input id="pet-breed" value={breed} maxLength={120} onChange={e => setBreed(e.target.value)}/></div>
      <div className="account-field"><label htmlFor="pet-age">Edad (opcional)</label><input id="pet-age" value={age} maxLength={80} onChange={e => setAge(e.target.value)} placeholder="Ej. 4 años"/></div>
      <div className="account-field full"><label htmlFor="pet-emergency">Contacto de emergencia (opcional)</label><input id="pet-emergency" value={contact} maxLength={240} onChange={e => setContact(e.target.value)} placeholder="Teléfono y nombre"/></div>
      <div className="account-form-actions"><button type="button" className="account-button outline" onClick={onClose}>Cancelar</button><button className="account-button" type="submit">Guardar perfil <Check size={15}/></button></div>
    </form>
  </section></div>;
}

export default function PetsPage() {
  const client = useQueryClient();
  const pets = useListPets({ query: { queryKey: getListPetsQueryKey() } });
  const createPet = useCreatePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const updatePet = useUpdatePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const deletePet = useDeletePet({ mutation: { onSuccess: () => void client.invalidateQueries({ queryKey: getListPetsQueryKey() }) } });
  const [editing, setEditing] = useState<PetProfile | null | 'new'>(null);
  const [failure, setFailure] = useState('');
  const saving = createPet.isPending || updatePet.isPending;
  const save = (input: PetInput) => {
    setFailure('');
    if (editing && editing !== 'new') updatePet.mutate({ petId: editing.id, data: input }, { onSuccess: () => setEditing(null), onError: e => setFailure(errorMessage(e)) });
    else createPet.mutate({ data: input }, { onSuccess: () => setEditing(null), onError: e => setFailure(errorMessage(e)) });
  };

  return <main className="account-content"><PageHeading kicker="Su identidad, siempre a mano" title="Mis mascotas" subtitle="Perfiles privados y persistentes para guardar lo esencial de su cuidado." action={<button className="account-button" onClick={() => setEditing('new')}><Plus size={15}/> Añadir mascota</button>}/>
    {failure && <div style={{ marginBottom: 14 }}><ErrorPanel message={failure} retry={() => setFailure('')}/></div>}
    {(pets.isLoading || saving || deletePet.isPending) && <LoadingPanel label={saving ? 'Guardando cambios…' : deletePet.isPending ? 'Eliminando perfil…' : 'Cargando perfiles…'}/>}
    {pets.isError && <ErrorPanel message={errorMessage(pets.error)} retry={() => void pets.refetch()}/>}
    {pets.data?.length ? <div className="account-grid two">{pets.data.map(pet => <article key={pet.id} className="account-panel">
      <PetSummary pet={pet}/><div style={{ display: 'flex', gap: 8, marginTop: 18, borderTop: '1px solid #efede3', paddingTop: 14 }}>
        <button className="account-button outline tiny" onClick={() => setEditing(pet)}><UserRound size={13}/> Editar</button>
        <label className="account-field" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 0 }}><span className="sr-only">Estado de {pet.name}</span><select aria-label={`Estado de ${pet.name}`} value={pet.status} onChange={e => updatePet.mutate({ petId: pet.id, data: { status: e.target.value as PetProfile['status'] } }, { onError: er => setFailure(errorMessage(er)) })} className="field" style={{ width: 'auto', padding: '7px 10px' }}><option value="home">En casa</option><option value="walking">De paseo</option><option value="lost">Perdida</option></select></label>
        <button className="account-button danger tiny" onClick={() => { if (window.confirm(`¿Eliminar el perfil de ${pet.name}? Esta acción no se puede deshacer.`)) deletePet.mutate({ petId: pet.id }, { onError: er => setFailure(errorMessage(er)) }); }} aria-label={`Eliminar a ${pet.name}`}><Trash2 size={13}/> Eliminar</button>
      </div>
    </article>)}</div> : null}
    {!pets.isLoading && !pets.isError && !pets.data?.length && <section className="account-panel empty-box"><PawPrint size={30}/><h3>Un perfil para cada historia</h3><p>Aún no has añadido mascotas. Empieza con la información que te gustaría tener siempre a mano.</p><button className="account-button" onClick={() => setEditing('new')}><Plus size={14}/> Crear primer perfil</button></section>}
    {editing && <PetEditor key={editing === 'new' ? 'new' : editing.id} pet={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={save}/>}
  </main>;
}
