import { Router } from "express";
import { getAllSportsDataController, getCricketData, getSoccerData, getTennisData } from "../../controllers/sports/SportControllers";
// import { getSportsList } from "../../controllers/sports/SportControllers";

const router = Router();

// GET /api/casino?casinoType=teen33
// router.get("/list", getSportsList);

router.get('/cricket-latest-matches-diamond', getCricketData);
router.get('/soccer-latest-matches-diamond', getSoccerData);
router.get('/tennis-latest-matches-diamond', getTennisData);
router.get('/all-latest-matches-diamond', getAllSportsDataController);

export default router;
