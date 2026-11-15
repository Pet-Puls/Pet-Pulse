import { describe, expect, it } from "vitest";
import { SaveProviderProfileBody } from "../../../lib/api-zod/src/generated/api";
import { isAllowedProviderLink } from "../src/lib/providerLinks";

describe("provider links", () => {
  it("allows optional links to be cleared", () => {
    expect(isAllowedProviderLink("websiteUrl", null)).toBe(true);
    expect(isAllowedProviderLink("instagramUrl", "")).toBe(true);
  });

  it("requires HTTPS for business websites", () => {
    expect(isAllowedProviderLink("websiteUrl", "https://example.com")).toBe(true);
    expect(isAllowedProviderLink("websiteUrl", "http://example.com")).toBe(false);
    expect(isAllowedProviderLink("websiteUrl", "javascript:alert(1)")).toBe(false);
  });

  it("accepts only links from the matching social network", () => {
    expect(isAllowedProviderLink("instagramUrl", "https://www.instagram.com/petpulse")).toBe(true);
    expect(isAllowedProviderLink("facebookUrl", "https://m.facebook.com/petpulse")).toBe(true);
    expect(isAllowedProviderLink("whatsappUrl", "https://wa.me/573001234567")).toBe(true);
    expect(isAllowedProviderLink("instagramUrl", "https://attacker.example/petpulse")).toBe(false);
    expect(isAllowedProviderLink("facebookUrl", "https://instagram.com/petpulse")).toBe(false);
  });

  it("keeps the generated request schema aligned with the HTTPS policy", () => {
    const profile = {
      name: "Clínica",
      category: "veterinary",
      neighborhood: "Centro",
    };

    expect(SaveProviderProfileBody.safeParse({
      ...profile,
      websiteUrl: "https://example.com",
    }).success).toBe(true);
    expect(SaveProviderProfileBody.safeParse({
      ...profile,
      websiteUrl: "http://example.com",
    }).success).toBe(false);
  });

  it("rejects embedded credentials in public links", () => {
    expect(isAllowedProviderLink("websiteUrl", "https://user:password@example.com")).toBe(false);
  });
});
