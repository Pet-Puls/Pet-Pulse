import { useGetPublicPet } from '@workspace/api-client-react';
import { AlertTriangle, PawPrint, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { Brand, ErrorPanel, LoadingPanel, errorMessage } from '@/components/app-shared';

export default function PublicPetPage({ token }: { token: string }) {
  const pet = useGetPublicPet(token, {
    query: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
    request: { skipAuth: true },
  });

  return <main className="public-pet-page">
    <header className="public-pet-header"><Brand/></header>
    {pet.isLoading ? <LoadingPanel label="Cargando ficha de la mascota…"/> : pet.isError || !pet.data
      ? <section className="public-pet-card"><ErrorPanel message={pet.isError ? errorMessage(pet.error) : 'Esta ficha pública no está disponible.'} retry={() => void pet.refetch()}/><Link href="/" className="text-link">Ir a PetPulse</Link></section>
      : <section className="public-pet-card">
        <div className="public-pet-photo">
          {pet.data.photoUrl ? <img src={pet.data.photoUrl} alt={`Foto de ${pet.data.name}`}/> : <PawPrint size={48}/>}
        </div>
        <div className="account-kicker">Ficha de identificación</div>
        <h1 className="display">{pet.data.name}</h1>
        <p className="public-pet-species">{pet.data.species}{pet.data.breed ? ` · ${pet.data.breed}` : ''}</p>
        {pet.data.isLost && <div className="notice-box public-pet-lost" role="status"><AlertTriangle size={18}/><span><strong>Marcada como perdida</strong><br/>Su tutor indicó que está buscando a {pet.data.name}.</span></div>}
        {pet.data.emergencyContact && <div className="notice-box public-pet-contact"><ShieldCheck size={18}/><span><strong>Contacto de emergencia</strong><br/>{pet.data.emergencyContact}</span></div>}
        <p className="map-privacy-note">Esta ficha muestra únicamente la información que el tutor eligió compartir.</p>
        <Link href="/" className="text-link">Conocer PetPulse</Link>
      </section>}
  </main>;
}
