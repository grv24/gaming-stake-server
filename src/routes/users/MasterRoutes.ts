import express from 'express';
import { getMasterById, getAllMaster, createMaster } from '../../controllers/users/MasterController';
import { superMasterAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance, lockUserAndDownlineMultiTable } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', superMasterAndAboveAuth, createMaster);
router.get('/get-accounts', paginationValidation, getAllMaster);
router.get('/get-accounts/:id', paginationValidation, getMasterById);
router.put('/account/balance', superMasterAndAboveAuth, addBalance);
router.put('/account/user-lock', superMasterAndAboveAuth, lockUserAndDownlineMultiTable);

export default router;