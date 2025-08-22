import express from 'express';
import { addBalance, changePasswordOfDownline, getAllDownlineUsers, getUserIp, lockUserOrBetAndDownlineMultiTable, setCreditRefForDownline, setExposureLimitForDownline, getSportsAndCasinoSetting, getOwnBalance } from '../../controllers/users/UserControllers';
import { clientAuth } from '../../middlewares/RoleAuth';

const router = express.Router();

router.get('/fetch-ip', getUserIp);
router.get('/own-balance', clientAuth, getOwnBalance);
router.get('/my-downline-users', clientAuth, getAllDownlineUsers);
router.get('/sports-casino-setting', clientAuth, getSportsAndCasinoSetting);
router.post('/deposit', clientAuth, addBalance);
router.post('/withdraw', clientAuth, addBalance);
router.patch('/lock', clientAuth, lockUserOrBetAndDownlineMultiTable);
router.patch('/set-exposure-limit', clientAuth, setExposureLimitForDownline);
router.patch('/set-credit-ref', clientAuth, setCreditRefForDownline);
router.patch('/change-password-downline', clientAuth, changePasswordOfDownline);

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