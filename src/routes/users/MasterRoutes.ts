import express from 'express';
import { getMasterById, getAllMaster, createMaster } from '../../controllers/users/MasterController';
import { masterAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', masterAndAboveAuth, createMaster);
router.get('/get-accounts', paginationValidation, getAllMaster);
router.get('/get-accounts/:id', paginationValidation, getMasterById);

export default router;