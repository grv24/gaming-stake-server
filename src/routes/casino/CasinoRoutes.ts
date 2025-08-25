import { Router } from "express";
import { getCasinoData, getCasinoResults } from "../../controllers/casino/CasinoOdds";
import {
    createCasino,
    getAllCasinos,
    getCasinoById,
    updateCasino,
    deleteCasino
} from "../../controllers/casino/DefaultCasino";
import { casinoResult , createBet, getCurrentBet } from "../../controllers/casino/CasinoBetController";
import { clientAuth } from "../../middlewares/RoleAuth";

const router = Router();

router.get("/results", clientAuth, casinoResult);
router.get("/current-bet", clientAuth, getCurrentBet);
router.get("/odds", getCasinoData);
router.get("/getCasinoTopTenResult", getCasinoResults);
router.post("/place-bet", clientAuth, createBet);

router.post("/", createCasino);
router.get("/", getAllCasinos);
router.get("/:id", getCasinoById);
router.put("/:id", updateCasino);
router.delete("/:id", deleteCasino);

export default router;