import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import brandsRouter from "./brands";
import postsRouter from "./posts";
import generateRouter from "./generate";
import billingRouter from "./billing";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(brandsRouter);
router.use(postsRouter);
router.use(generateRouter);
router.use(billingRouter);
router.use(dashboardRouter);

export default router;
