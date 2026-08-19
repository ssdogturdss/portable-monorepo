import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiSessionsRouter from "./ai-sessions";
import aiChatRouter from "./ai-chat";
import aiModelsRouter from "./ai-models";
import templatesRouter from "./templates";
import githubRouter from "./github";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiSessionsRouter);
router.use(aiChatRouter);
router.use(aiModelsRouter);
router.use(templatesRouter);
router.use(githubRouter);

export default router;
