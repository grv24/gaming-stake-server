import express from "express";
import {
  addBalance,
  changePasswordOfDownline,
  getAllDownlineUsers,
  getUserIp,
  lockUserOrBetAndDownlineMultiTable,
  setCreditRefForDownline,
  setExposureLimitForDownline,
  getSportsAndCasinoSetting,
  getOwnBalance,
  getOwnExposure,
  getAccountTransactions,
  withdrawBalance,
  getPendingBet,
} from "../../controllers/users/UserControllers";
import { clientAuth } from "../../middlewares/RoleAuth";
import { trackUserActivity, trackBalanceActivity } from "../../middlewares/ActivityTrackingMiddleware";

const router = express.Router();

router.get("/fetch-ip", getUserIp);
router.get("/own-balance", clientAuth, trackUserActivity('balance_view', 'Viewed own balance'), getOwnBalance);
router.get("/own-exposure", clientAuth, trackUserActivity('exposure_view', 'Viewed own exposure'), getOwnExposure);
router.get("/my-downline-users", clientAuth, trackUserActivity('downline_view', 'Viewed downline users'), getAllDownlineUsers);
router.get("/sports-casino-setting", clientAuth, trackUserActivity('settings_view', 'Viewed sports and casino settings'), getSportsAndCasinoSetting);
router.post("/deposit", clientAuth, trackBalanceActivity('deposit'), addBalance);
router.post("/withdraw", clientAuth, trackBalanceActivity('withdraw'), withdrawBalance);
router.patch("/lock", clientAuth, trackUserActivity('user_lock', 'Locked/unlocked user or betting'), lockUserOrBetAndDownlineMultiTable);
router.patch("/set-exposure-limit", clientAuth, trackUserActivity('exposure_limit', 'Set exposure limit for downline'), setExposureLimitForDownline);
router.patch("/set-credit-ref", clientAuth, trackUserActivity('credit_ref', 'Set credit reference for downline'), setCreditRefForDownline);
router.patch("/change-password-downline", clientAuth, trackUserActivity('password_change_downline', 'Changed downline password'), changePasswordOfDownline);

router.get("/account-transactions", clientAuth, trackUserActivity('transactions_view', 'Viewed account transactions'), getAccountTransactions);

router.get("/pending-bets", clientAuth, trackUserActivity('pending_bets_view', 'Viewed pending bets'), getPendingBet);

// need to create this to handle user and bet status
// /api/v1/users/change-user-lock-and-bet-lock/${userId}`,
//payload: {
//  userId,
// lockBet,
// lockUser,
// transactionPassword,
// userType,
//}

export default router;
