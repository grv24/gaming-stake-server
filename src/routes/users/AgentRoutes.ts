import express from 'express';
import { getAgentById, getAllAgent, createAgent } from '../../controllers/users/AgentController';
import { superAgentAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance, lockUserAndDownlineMultiTable } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', superAgentAndAboveAuth, createAgent);
router.get('/get-accounts', paginationValidation, getAllAgent);
router.get('/get-accounts/:id', paginationValidation, getAgentById);
router.put('/account/balance', superAgentAndAboveAuth, addBalance);
router.put('/account/user-lock', superAgentAndAboveAuth, lockUserAndDownlineMultiTable);


export default router;