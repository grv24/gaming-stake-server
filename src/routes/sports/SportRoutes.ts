import { Router } from "express";
import { getAllSportsDataController, getCricketData, getCricketScore, getFIlteredData, getOddsData, getSoccerData, getTennisData } from "../../controllers/sports/SportControllers";
import { createBet, getCurrentBet, settleUserSportBets } from "../../controllers/sports/SportsBetController";
import { clientAuth } from "../../middlewares/RoleAuth";
import { getDownlineBets, reopenBet, updateBet } from "../../controllers/sports/ManualSettle";
import { testSportSettlement } from "../../controllers/sports/TestSportSettlement";
// import { getSportsList } from "../../controllers/sports/SportControllers";

const router = Router();

// GET /api/casino?casinoType=teen33
// router.get("/list", getSportsList);

router.post("/placeBet", clientAuth, createBet);
router.get("/current-bet", clientAuth, getCurrentBet);
router.patch("/settle-my-sports-bets", clientAuth, settleUserSportBets);
router.get('/cricket-score', clientAuth, getCricketScore)
router.get("/bets/downline", clientAuth, getDownlineBets);
router.patch("/bets/:id", clientAuth, updateBet);
router.patch("/bets/reopen/:id", clientAuth, reopenBet);

// Test endpoint for sport settlement
router.post("/test-settlement", clientAuth, testSportSettlement);

router.get('/cricket-latest-matches-diamond', getCricketData);
router.get('/soccer-latest-matches-diamond', getSoccerData);
router.get('/tennis-latest-matches-diamond', getTennisData);
router.get('/all-latest-matches-diamond', getAllSportsDataController);
router.get('/current-matches', getFIlteredData);
router.get('/live-match-odds/:sportId/:eventId', getOddsData);


export default router;
