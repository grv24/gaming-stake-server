import { Router } from "express";
import { getAllSportsDataController, getCricketData, getCricketScore, getFIlteredData, getOddsData, getSoccerData, getTennisData } from "../../controllers/sports/SportControllers";
import { createBet, getCurrentBet, settleUserSportBets } from "../../controllers/sports/SportsBetController";
import { clientAuth } from "../../middlewares/RoleAuth";
import { getDownlineBets, reopenBet, updateBet } from "../../controllers/sports/ManualSettle";
import { testSportSettlement } from "../../controllers/sports/TestSportSettlement";
import { trackBettingActivity, trackUserActivity } from "../../middlewares/ActivityTrackingMiddleware";
// import { getSportsList } from "../../controllers/sports/SportControllers";

const router = Router();

// GET /api/casino?casinoType=teen33
// router.get("/list", getSportsList);

router.post("/placeBet", clientAuth, trackBettingActivity('sports'), createBet);
router.get("/current-bet", clientAuth, getCurrentBet);
router.patch("/settle-my-sports-bets", clientAuth, trackUserActivity('sports_settlement', 'Settled sports bets'), settleUserSportBets);
router.get('/cricket-score', clientAuth, trackUserActivity('sports_view', 'Viewed cricket score'), getCricketScore)
router.get("/bets/downline", clientAuth, trackUserActivity('downline_view', 'Viewed downline sports bets'), getDownlineBets);
router.patch("/bets/:id", clientAuth, trackUserActivity('bet_update', 'Updated sports bet'), updateBet);
router.patch("/bets/reopen/:id", clientAuth, trackUserActivity('bet_reopen', 'Reopened sports bet'), reopenBet);

// Test endpoint for sport settlement
router.post("/test-settlement", clientAuth, trackUserActivity('test_settlement', 'Tested sports settlement'), testSportSettlement);

router.get('/cricket-latest-matches-diamond', getCricketData);
router.get('/soccer-latest-matches-diamond', getSoccerData);
router.get('/tennis-latest-matches-diamond', getTennisData);
router.get('/all-latest-matches-diamond', getAllSportsDataController);
router.get('/current-matches', getFIlteredData);
router.get('/live-match-odds/:sportId/:eventId', getOddsData);


export default router;
