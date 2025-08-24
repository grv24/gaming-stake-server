import { Router } from "express";
import { getCasinoData, getCasinoResults } from "../../controllers/casino/CasinoOdds";
import {
    createCasino,
    getAllCasinos,
    getCasinoById,
    updateCasino,
    deleteCasino
} from "../../controllers/casino/DefaultCasino";
import { createBet, triggerCasinoEvent } from "../../controllers/casino/CasinoBetController";
import { clientAuth } from "../../middlewares/RoleAuth";

const router = Router();

router.get("/odds", getCasinoData);
router.get("/getCasinoTopTenResult", getCasinoResults);
router.post("/place-bet", clientAuth, createBet);

// Manual trigger for testing casino events
router.post("/trigger-event", triggerCasinoEvent);

router.post("/", createCasino);
router.get("/", getAllCasinos);
router.get("/:id", getCasinoById);
router.put("/:id", updateCasino);
router.delete("/:id", deleteCasino);
router.get("/odds", getCasinoData);

export default router;
