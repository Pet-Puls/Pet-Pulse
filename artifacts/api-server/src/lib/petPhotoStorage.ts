const maxPhotoBytes = 5 * 1024 * 1024;
const signedUrlLifetimeSeconds = 60 * 60;

function getStorageConfig() {
  const projectUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PET_PHOTOS_BUCKET?.trim() || "pet-photos";

  if (!projectUrl || !serviceRoleKey) {
    throw new Error("Pet photo storage is not configured.");
  }

  return { projectUrl, serviceRoleKey, bucket };
}

function getObjectUrl(projectUrl: string, bucket: string, path: string, operation: "object" | "sign") {
  const objectPath = path.split("/").map(encodeURIComponent).join("/");
  const operationPath = operation === "sign" ? "sign/" : "";
  return `${projectUrl}/storage/v1/object/${operationPath}${encodeURIComponent(bucket)}/${objectPath}`;
}

async function storageRequest(
  url: string,
  serviceRoleKey: string,
  init: RequestInit,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  return fetch(url, { ...init, headers });
}

export function getPetPhotoMaxBytes() {
  return maxPhotoBytes;
}

export async function uploadPetPhoto(
  path: string,
  contentType: string,
  bytes: Buffer,
): Promise<void> {
  const { projectUrl, serviceRoleKey, bucket } = getStorageConfig();
  const response = await storageRequest(
    getObjectUrl(projectUrl, bucket, path, "object"),
    serviceRoleKey,
    {
      method: "PUT",
      headers: { "Content-Type": contentType, "x-upsert": "true" },
      body: bytes,
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage rejected the photo upload (HTTP ${response.status}).`);
  }
}

export async function deletePetPhoto(path: string): Promise<void> {
  const { projectUrl, serviceRoleKey, bucket } = getStorageConfig();
  const response = await storageRequest(
    `${projectUrl}/storage/v1/object/${encodeURIComponent(bucket)}`,
    serviceRoleKey,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [path] }),
    },
  );
  if (!response.ok && response.status !== 404) {
    throw new Error(`Supabase Storage rejected the photo deletion (HTTP ${response.status}).`);
  }
}

export async function getPetPhotoUrl(path: string): Promise<string> {
  const { projectUrl, serviceRoleKey, bucket } = getStorageConfig();
  const response = await storageRequest(
    getObjectUrl(projectUrl, bucket, path, "sign"),
    serviceRoleKey,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: signedUrlLifetimeSeconds }),
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage could not sign the pet photo URL (HTTP ${response.status}).`);
  }
  const result = await response.json() as { signedURL?: unknown };
  if (typeof result.signedURL !== "string" || !result.signedURL) {
    throw new Error("Supabase Storage returned an invalid signed photo URL.");
  }
  return new URL(result.signedURL.replace(/^\/+/, ""), `${projectUrl}/storage/v1/`).toString();
}
