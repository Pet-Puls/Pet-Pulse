const socialHosts = {
  instagramUrl: new Set(["instagram.com", "www.instagram.com"]),
  facebookUrl: new Set(["facebook.com", "www.facebook.com", "m.facebook.com"]),
  whatsappUrl: new Set(["wa.me", "www.whatsapp.com", "whatsapp.com", "api.whatsapp.com"]),
} as const;

export type ProviderLinkField = keyof typeof socialHosts | "websiteUrl";

export function isAllowedProviderLink(
  key: ProviderLinkField,
  value: string | null | undefined,
): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    return key === "websiteUrl" || socialHosts[key].has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
