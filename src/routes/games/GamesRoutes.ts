import express from "express";
import { getButtonByUserId, updateButtonByUserId } from "../../controllers/games/GameController";
import { clientAuth } from "../../middlewares/RoleAuth";

const router = express.Router();

router.get("/buttons/:gameType", clientAuth, getButtonByUserId);
router.put("/buttons/:gameType", clientAuth, updateButtonByUserId);

export default router;
