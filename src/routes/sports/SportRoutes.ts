import { Router } from "express";
import { getAllSportsDataController, getCricketData, getFIlteredData, getOddsData, getSoccerData, getTennisData } from "../../controllers/sports/SportControllers";
import { createBet, getCurrentBet } from "../../controllers/sports/SportsBetController";
import { clientAuth } from "../../middlewares/RoleAuth";
// import { getSportsList } from "../../controllers/sports/SportControllers";

const router = Router();

// GET /api/casino?casinoType=teen33
// router.get("/list", getSportsList);

router.post("/placeBet", clientAuth, createBet);
router.get("/current-bet", clientAuth, getCurrentBet);

router.get('/cricket-latest-matches-diamond', getCricketData);
router.get('/soccer-latest-matches-diamond', getSoccerData);
router.get('/tennis-latest-matches-diamond', getTennisData);
router.get('/all-latest-matches-diamond', getAllSportsDataController);
router.get('/current-matches', getFIlteredData);
router.get('/live-match-odds/:sportId/:eventId', getOddsData);


export default router;
