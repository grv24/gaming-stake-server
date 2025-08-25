import express from "express";
import { getButtonByUserId, updateButtonByUserId } from "../../controllers/games/GamesController";
import { clientAuth } from "../../middlewares/RoleAuth";

const router = express.Router();

router.get("/buttons", clientAuth, getButtonByUserId);
router.put("/buttons", clientAuth, updateButtonByUserId);

export default router;