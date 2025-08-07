import express from 'express';
import { getAdminById, getAllAdmin, createAdmin } from '../../controllers/users/AdminController';
import { adminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', adminAndAboveAuth, createAdmin);
router.get('/get-accounts', paginationValidation, getAllAdmin);
router.get('/get-accounts/:id', paginationValidation, getAdminById);

export default router;