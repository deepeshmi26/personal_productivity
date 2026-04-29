import { Router, type IRouter } from "express";
import healthRouter from "./health";
import responsesRouter from "./responses";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(responsesRouter);
router.use(settingsRouter);

export default router;
