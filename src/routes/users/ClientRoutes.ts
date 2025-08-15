import express from 'express';
import { getClientById, getAllClient, createClient } from '../../controllers/users/ClientController';
import { agentAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', agentAndAboveAuth, createClient);
router.get('/get-accounts', paginationValidation, getAllClient);
router.get('/get-accounts/:id', paginationValidation, getClientById);
router.put('/account/balance', agentAndAboveAuth, addBalance);

export default router;