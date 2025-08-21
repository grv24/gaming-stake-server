import express from 'express';
import { getSuperAgentById, getAllSuperAgent, createSuperAgent } from '../../controllers/users/SuperAgentController';
import { masterAndAboveAuth, superAgentAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', masterAndAboveAuth, createSuperAgent);
router.get('/get-accounts', paginationValidation, getAllSuperAgent);
router.get('/get-accounts/:id', paginationValidation, getSuperAgentById);
router.put('/account/balance', masterAndAboveAuth, addBalance);
// router.put('/account/user-lock', masterAndAboveAuth, lockUserAndDownlineMultiTable);

export default router;