import express from "express";
import { getButtonByUserId, updateButtonByUserId } from "../../controllers/games/GamesController";
import { clientAuth } from "../../middlewares/RoleAuth";
import { trackUserActivity } from "../../middlewares/ActivityTrackingMiddleware";

const router = express.Router();

router.get("/buttons", clientAuth, trackUserActivity('button_view', 'Viewed game button preferences'), getButtonByUserId);
router.put("/buttons", clientAuth, trackUserActivity('button_update', 'Updated game button preferences'), updateButtonByUserId);

export default router;