import { Router } from "express";
import { activateLicense, getLicenseStatus } from "../controllers/license.controller";

const router = Router();

router.get("/", getLicenseStatus);
router.post("/activate", activateLicense);

export default router;
