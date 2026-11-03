import { and, asc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreatePetBody,
  CreatePetResponse,
  DeletePetParams,
  ListPetsResponse,
  UpdatePetBody,
  UpdatePetParams,
  UpdatePetResponse,
} from "@workspace/api-zod";
import { db, petsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

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

  res.json(ListPetsResponse.parse(pets));
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
    })
    .returning();

  res.status(201).json(CreatePetResponse.parse(pet));
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

    res.json(UpdatePetResponse.parse(pet));
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
      .returning({ id: petsTable.id });

    if (!deleted) {
      res.status(404).json({ error: "No se encontró esa mascota en tu cuenta." });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
