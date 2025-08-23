import { Router } from "express";
import { getCasinoData, getCasinoResults } from "../../controllers/casino/CasinoOdds";
import {
    createCasino,
    getAllCasinos,
    getCasinoById,
    updateCasino,
    deleteCasino
} from "../../controllers/casino/DefaultCasino";

const router = Router();

router.get("/odds", getCasinoData);
router.get("/getCasinoTopTenResult", getCasinoResults);

router.post("/", createCasino);
router.get("/", getAllCasinos);
router.get("/:id", getCasinoById);
router.put("/:id", updateCasino);
router.delete("/:id", deleteCasino);
router.get("/odds", getCasinoData);

export default router;
