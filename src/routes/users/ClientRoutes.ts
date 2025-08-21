import express from 'express';
import { getClientById, getAllClient, createClient, clientLogin, changeOwnPassword } from '../../controllers/users/ClientController';
import { agentAndAboveAuth, clientAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance, lockUserAndDownlineMultiTable } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/login', clientLogin);
router.post('/new-account', agentAndAboveAuth, createClient);
router.get('/get-accounts', paginationValidation, getAllClient);
router.get('/get-accounts/:id', paginationValidation, getClientById);
router.put('/account/balance', agentAndAboveAuth, addBalance);
router.put('/account/user-lock', agentAndAboveAuth, lockUserAndDownlineMultiTable);
router.patch('/change-own-password', clientAuth, changeOwnPassword)


export default router;