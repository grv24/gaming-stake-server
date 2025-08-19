import { Router } from "express";
import { getCasinoData } from "../../controllers/casino/CasinoOdds";

const router = Router();

// GET /api/casino?casinoType=teen33
router.get("/odds", getCasinoData);

export default router;
