import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import appointmentsRouter from "./appointments";
import healthRouter from "./health";
import lostPetReportsRouter from "./lostPetReports";
import meRouter from "./me";
import notificationPreferencesRouter from "./notificationPreferences";
import petsRouter from "./pets";
import providerProfileRouter from "./providerProfile";
import providerResourcesRouter from "./providerResources";

const router: IRouter = Router();

router.use(healthRouter);
router.use(lostPetReportsRouter);
router.use(meRouter);
router.use(notificationPreferencesRouter);
router.use(appointmentsRouter);
router.use(petsRouter);
router.use(providerProfileRouter);
router.use(providerResourcesRouter);
router.use(adminRouter);

export default router;
