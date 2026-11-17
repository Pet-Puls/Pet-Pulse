export const petSpeciesOptions = [
  "Perro",
  "Gato",
  "Ave",
  "Conejo",
  "Roedor",
  "Reptil",
  "Pez",
  "Otro",
] as const;

export type PetAgeUnit = "años" | "meses";

export function isPetSpecies(value: string): boolean {
  return petSpeciesOptions.some(option => option === value);
}

export function formatPetAge(value: string, unit: PetAgeUnit): string | null {
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) return null;
  const label = value === "1" ? (unit === "años" ? "año" : "mes") : unit;
  return `${value} ${label}`;
}

export function parsePetAge(value: string): { value: string; unit: PetAgeUnit } | null {
  const match = /^(0|[1-9]\d*) (año|años|mes|meses)$/.exec(value);
  if (!match || !Number.isSafeInteger(Number(match[1]))) return null;
  return { value: match[1], unit: match[2].startsWith("año") ? "años" : "meses" };
}
