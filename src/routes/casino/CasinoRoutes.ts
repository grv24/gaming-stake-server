import { Router } from "express";
import { getCasinoData, getCasinoHistory, getCasinoMatchDetails, getCasinoResults, getCasinoHealth, resetCasinoCircuitBreaker, requestCasinoUpdate, getCasinoDataForWhitelistPanel } from "../../controllers/casino/CasinoOdds";
import {
    createCasino,
    getAllCasinos,
    getCasinoById,
    updateCasino,
    deleteCasino
} from "../../controllers/casino/DefaultCasino";
import { casinoResult, createBet, getCurrentBet, getBetDetails } from "../../controllers/casino/CasinoBetController";
import { clientAuth } from "../../middlewares/RoleAuth";
import { settleUserCasinoBets, reverseCasinoBetSettlement, getSettlementReversalHistory, getDownlineSettledBets, getDownlineUsers, debugGetAllSettledBets } from "../../controllers/casino/settlement/SettleController";
import { getActiveCasinosForWhitelist } from "../../controllers/whitelist/WhitelistCasinoController";
import { trackBettingActivity, trackUserActivity } from "../../middlewares/ActivityTrackingMiddleware";
const router = Router();


router.get("/results", clientAuth, casinoResult);
router.get("/current-bet", clientAuth, getCurrentBet);
router.get("/bet-details/:betId", clientAuth, trackUserActivity('bet_details_view', 'Viewed bet details'), getBetDetails);
router.get("/odds", getCasinoData);
router.get("/getCasinoTopTenResult", getCasinoResults);
router.post("/place-bet", clientAuth, trackBettingActivity('casino'), createBet);
router.patch("/settle-my-casino-bets", clientAuth, trackUserActivity('casino_settlement', 'Settled casino bets'), settleUserCasinoBets);

// Settlement reversal endpoints (upline users only)
router.post("/reverse-settlement", clientAuth, trackUserActivity('casino_reversal', 'Reversed casino bet settlement'), reverseCasinoBetSettlement);
router.get("/reversal-history", clientAuth, getSettlementReversalHistory);

// Downline management endpoints (upline users only)
router.get("/downline-settled-bets", clientAuth, trackUserActivity('downline_view', 'Viewed downline settled bets'), getDownlineSettledBets);
router.get("/downline-users", clientAuth, trackUserActivity('downline_view', 'Viewed downline users'), getDownlineUsers);

// Debug endpoint (for troubleshooting)
router.get("/debug-all-settled-bets", clientAuth, debugGetAllSettledBets);

router.get("/history", clientAuth, trackUserActivity('casino_history', 'Viewed casino betting history'), getCasinoHistory);
router.get("/match-details", clientAuth, trackUserActivity('casino_details', 'Viewed casino match details'), getCasinoMatchDetails);

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