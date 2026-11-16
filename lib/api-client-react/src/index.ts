export * from "./generated/api";
export * from "./generated/api.schemas";
export { ApiError, setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";
export { formatPetAge, isPetSpecies, parsePetAge, petSpeciesOptions } from "@workspace/api-zod";
export type { PetAgeUnit } from "@workspace/api-zod";
