import express from 'express';
import { getClientById, getAllClient, createClient, clientLogin, changeOwnPassword } from '../../controllers/users/ClientController';
import { agentAndAboveAuth, clientAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';
import { trackLoginActivity, trackUserActivity } from '../../middlewares/ActivityTrackingMiddleware';

const router = express.Router();

router.post('/login', trackLoginActivity, clientLogin);
router.post('/new-account', agentAndAboveAuth, trackUserActivity('account_creation', 'Created new client account'), createClient);
router.get('/get-accounts', paginationValidation, getAllClient);
router.get('/get-accounts/:id', paginationValidation, getClientById);
router.put('/account/balance', agentAndAboveAuth, trackUserActivity('balance_adjustment', 'Adjusted client account balance'), addBalance);
// router.put('/account/user-lock', agentAndAboveAuth, lockUserAndDownlineMultiTable);
router.patch('/change-own-password', clientAuth, trackUserActivity('password_change', 'Changed own password'), changeOwnPassword)


export default router;