import express from 'express';
import { getSuperMasterById, getAllSuperMaster, createSuperMaster } from '../../controllers/users/SuperMasterController';
import { superMasterAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', superMasterAndAboveAuth, createSuperMaster);
router.get('/get-accounts', paginationValidation, getAllSuperMaster);
router.get('/get-accounts/:id', paginationValidation, getSuperMasterById);

export default router;