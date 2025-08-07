import express from 'express';
import { getSuperAgentById, getAllSuperAgent, createSuperAgent } from '../../controllers/users/SuperAgentController';
import { superAgentAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', superAgentAndAboveAuth, createSuperAgent);
router.get('/get-accounts', paginationValidation, getAllSuperAgent);
router.get('/get-accounts/:id', paginationValidation, getSuperAgentById);

export default router;