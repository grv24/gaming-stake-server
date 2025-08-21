import express from 'express';
import { getMiniAdminById, getAllMiniAdmin, createMiniAdmin } from '../../controllers/users/MiniAdminController';
import { adminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', adminAndAboveAuth, createMiniAdmin);
router.get('/get-accounts', paginationValidation, getAllMiniAdmin);
router.get('/get-accounts/:id', paginationValidation, getMiniAdminById);
router.put('/account/balance', adminAndAboveAuth, addBalance);
// router.put('/account/user-lock', adminAndAboveAuth, lockUserAndDownlineMultiTable);


export default router;