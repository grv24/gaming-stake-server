import express from 'express';
import { getMiniAdminById, getAllMiniAdmin, createMiniAdmin } from '../../controllers/users/MiniAdminController';
import { miniAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', miniAdminAndAboveAuth, createMiniAdmin);
router.get('/get-accounts', paginationValidation, getAllMiniAdmin);
router.get('/get-accounts/:id', paginationValidation, getMiniAdminById);

export default router;