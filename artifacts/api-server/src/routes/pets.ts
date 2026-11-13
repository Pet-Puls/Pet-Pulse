import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import express from "express";
import {
  CreatePetBody,
  CreatePetResponse,
  DeletePetParams,
  GetPublicPetResponse,
  ListPetsResponse,
  CreatePetQrResponse,
  UpdatePetBody,
  UpdatePetParams,
  UpdatePetResponse,
} from "@workspace/api-zod";
import { db, petsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";
import { logger } from "../lib/logger";
import {
  deletePetPhoto,
  getPetPhotoMaxBytes,
  getPetPhotoUrl,
  uploadPetPhoto,
} from "../lib/petPhotoStorage";

const router: IRouter = Router();

async function toPetProfile(pet: typeof petsTable.$inferSelect) {
  return {
    ...pet,
    photoUrl: pet.photoPath ? await getPetPhotoUrl(pet.photoPath) : null,
    qrEnabled: pet.qrToken !== null,
  };
}

function isValidPhotoContent(contentType: string, bytes: Buffer) {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8
      && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === "image/webp") {
    return bytes.length >= 12
      && bytes.toString("ascii", 0, 4) === "RIFF"
      && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

router.get("/public/pets/:token", async (req, res): Promise<void> => {
  const token = req.params.token;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    res.status(404).json({ error: "Esta ficha pública no está disponible." });
    return;
  }

  const [pet] = await db.select().from(petsTable).where(eq(petsTable.qrToken, token)).limit(1);
  if (!pet) {
    res.status(404).json({ error: "Esta ficha pública no está disponible." });
    return;
  }

  const profile = {
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    photoUrl: pet.photoPath ? await getPetPhotoUrl(pet.photoPath) : null,
    emergencyContact: pet.shareEmergencyContact ? pet.emergencyContact : null,
    isLost: pet.status === "lost",
  };
  res.setHeader("Cache-Control", "no-store");
  res.json(GetPublicPetResponse.parse(profile));
});

router.use("/pets", requireAuth);

router.get("/pets", requireRole("owner"), async (req, res): Promise<void> => {
  const profile = req.petPulseProfile;
  if (!profile) {
    res.status(403).json({ error: "Completa la configuración de tu cuenta." });
    return;
  }

  const pets = await db
    .select()
    .from(petsTable)
    .where(eq(petsTable.ownerId, profile.id))
    .orderBy(asc(petsTable.createdAt));

  const profiles = await Promise.all(pets.map(toPetProfile));
  res.json(ListPetsResponse.parse(profiles));
});

router.post("/pets", requireRole("owner"), async (req, res): Promise<void> => {
  const parsed = CreatePetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const profile = req.petPulseProfile;
  if (!profile) {
    res.status(403).json({ error: "Completa la configuración de tu cuenta." });
    return;
  }

  const [pet] = await db
    .insert(petsTable)
    .values({
      ownerId: profile.id,
      name: parsed.data.name.trim(),
      species: parsed.data.species.trim(),
      breed: parsed.data.breed?.trim() || null,
      age: parsed.data.age?.trim() || null,
      emergencyContact: parsed.data.emergencyContact?.trim() || null,
      shareEmergencyContact: parsed.data.shareEmergencyContact ?? false,
    })
    .returning();

  res.status(201).json(CreatePetResponse.parse(await toPetProfile(pet)));
});

router.patch(
  "/pets/:petId",
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = UpdatePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdatePetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const update = {
      ...parsed.data,
      ...(parsed.data.name !== undefined
        ? { name: parsed.data.name.trim() }
        : {}),
      ...(parsed.data.species !== undefined
        ? { species: parsed.data.species.trim() }
        : {}),
      ...(parsed.data.breed !== undefined
        ? { breed: parsed.data.breed?.trim() || null }
        : {}),
      ...(parsed.data.age !== undefined
        ? { age: parsed.data.age?.trim() || null }
        : {}),
      ...(parsed.data.emergencyContact !== undefined
        ? { emergencyContact: parsed.data.emergencyContact?.trim() || null }
        : {}),
      ...(parsed.data.shareEmergencyContact !== undefined
        ? { shareEmergencyContact: parsed.data.shareEmergencyContact }
        : {}),
    };

    const [pet] = await db
      .update(petsTable)
      .set(update)
      .where(
        and(
          eq(petsTable.id, params.data.petId),
          eq(petsTable.ownerId, profile.id),
        ),
      )
      .returning();

    if (!pet) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }

    res.json(UpdatePetResponse.parse(await toPetProfile(pet)));
  },
);

router.put(
  "/pets/:petId/photo",
  requireRole("owner"),
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: getPetPhotoMaxBytes(),
  }),
  async (req, res): Promise<void> => {
    const params = UpdatePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }
    const contentType = req.headers["content-type"];
    if (typeof contentType !== "string" || !Buffer.isBuffer(req.body) || !isValidPhotoContent(contentType, req.body)) {
      res.status(415).json({ error: "Usa una imagen JPEG, PNG o WebP válida." });
      return;
    }

    const [existingPet] = await db
      .select({ id: petsTable.id })
      .from(petsTable)
      .where(and(eq(petsTable.id, params.data.petId), eq(petsTable.ownerId, profile.id)))
      .limit(1);
    if (!existingPet) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }

    const photoPath = `${profile.id}/${params.data.petId}/photo`;
    await uploadPetPhoto(photoPath, contentType, req.body);
    const [pet] = await db
      .update(petsTable)
      .set({ photoPath })
      .where(and(eq(petsTable.id, params.data.petId), eq(petsTable.ownerId, profile.id)))
      .returning();
    res.json(UpdatePetResponse.parse(await toPetProfile(pet)));
  },
);

router.post(
  "/pets/:petId/qr",
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = UpdatePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const token = randomBytes(32).toString("base64url");
    const [pet] = await db
      .update(petsTable)
      .set({ qrToken: sql`COALESCE(${petsTable.qrToken}, ${token})` })
      .where(and(eq(petsTable.id, params.data.petId), eq(petsTable.ownerId, profile.id)))
      .returning({ qrToken: petsTable.qrToken });
    if (!pet?.qrToken) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }
    res.json(CreatePetQrResponse.parse({ token: pet.qrToken }));
  },
);

router.delete(
  "/pets/:petId/qr",
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = UpdatePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const [pet] = await db
      .update(petsTable)
      .set({ qrToken: null })
      .where(and(eq(petsTable.id, params.data.petId), eq(petsTable.ownerId, profile.id)))
      .returning({ id: petsTable.id });
    if (!pet) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }
    res.sendStatus(204);
  },
);

router.delete(
  "/pets/:petId",
  requireRole("owner"),
  async (req, res): Promise<void> => {
    const params = DeletePetParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const profile = req.petPulseProfile;
    if (!profile) {
      res.status(403).json({ error: "Completa la configuración de tu cuenta." });
      return;
    }

    const [deleted] = await db
      .delete(petsTable)
      .where(
        and(
          eq(petsTable.id, params.data.petId),
          eq(petsTable.ownerId, profile.id),
        ),
      )
      .returning({ id: petsTable.id, photoPath: petsTable.photoPath });

    if (!deleted) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }

    if (deleted.photoPath) {
      try {
        await deletePetPhoto(deleted.photoPath);
      } catch (error) {
        logger.warn({ err: error, petId: deleted.id }, "Could not delete the removed pet's photo from storage");
      }
    }
    res.sendStatus(204);
  },
);

export default router;
