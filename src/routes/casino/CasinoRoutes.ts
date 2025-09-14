import { Router } from "express";
import { getCasinoData, getCasinoHistory, getCasinoMatchDetails, getCasinoResults, getCasinoHealth, resetCasinoCircuitBreaker, requestCasinoUpdate, getCasinoDataForWhitelistPanel } from "../../controllers/casino/CasinoOdds";
import {
    createCasino,
    getAllCasinos,
    getCasinoById,
    updateCasino,
    deleteCasino
} from "../../controllers/casino/DefaultCasino";
import { casinoResult, createBet, getCurrentBet } from "../../controllers/casino/CasinoBetController";
import { clientAuth } from "../../middlewares/RoleAuth";
import { settleUserCasinoBets } from "../../controllers/casino/settlement/SettleController";
import { getActiveCasinosForWhitelist } from "../../controllers/whitelist/WhitelistCasinoController";
const router = Router();


router.get("/results", clientAuth, casinoResult);
router.get("/current-bet", clientAuth, getCurrentBet);
router.get("/odds", getCasinoData);
router.get("/getCasinoTopTenResult", getCasinoResults);
router.post("/place-bet", clientAuth, createBet);
router.patch("/settle-my-casino-bets", clientAuth, settleUserCasinoBets);

router.get("/history", clientAuth, getCasinoHistory);
router.get("/match-details", clientAuth, getCasinoMatchDetails);

// Panel-specific casino endpoints
router.get("/panel/:whitelistId", getActiveCasinosForWhitelist);
router.get("/panel/:whitelistId/data", getCasinoDataForWhitelistPanel);

// Health check and circuit breaker management endpoints
router.get("/health", getCasinoHealth);
router.post("/reset-circuit-breaker", resetCasinoCircuitBreaker);
router.post("/request-update", requestCasinoUpdate);

router.post("/", createCasino);
router.get("/", getAllCasinos);
router.get("/:id", getCasinoById);
router.put("/:id", updateCasino);
router.delete("/:id", deleteCasino);


export default router;