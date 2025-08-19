import { Router } from "express";
import { getSportsList } from "../../controllers/sports/SportControllers";

const router = Router();

// GET /api/casino?casinoType=teen33
router.get("/list", getSportsList);

export default router;
