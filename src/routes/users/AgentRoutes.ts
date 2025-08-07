import express from 'express';
import { getAgentById, getAllAgent, createAgent } from '../../controllers/users/AgentController';
import { agentAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', agentAndAboveAuth, createAgent);
router.get('/get-accounts', paginationValidation, getAllAgent);
router.get('/get-accounts/:id', paginationValidation, getAgentById);

export default router;