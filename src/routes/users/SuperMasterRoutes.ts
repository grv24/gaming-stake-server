import express from 'express';
import { getSuperMasterById, getAllSuperMaster, createSuperMaster } from '../../controllers/users/SuperMasterController';
import { miniAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance, lockUserAndDownlineMultiTable } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', miniAdminAndAboveAuth, createSuperMaster);
router.get('/get-accounts', paginationValidation, getAllSuperMaster);
router.get('/get-accounts/:id', paginationValidation, getSuperMasterById);
router.put('/account/balance', miniAdminAndAboveAuth, addBalance);
router.put('/account/user-lock', miniAdminAndAboveAuth, lockUserAndDownlineMultiTable);


export default router;