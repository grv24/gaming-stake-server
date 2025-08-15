import express from 'express';
import { getAdminById, getAllAdmin, createAdmin, adminLogin } from '../../controllers/users/AdminController';
import { techAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance, lockUserAndDownlineMultiTable } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/new-account', techAdminAndAboveAuth, createAdmin);
router.get('/get-accounts', paginationValidation, getAllAdmin);
router.get('/get-accounts/:id', paginationValidation, getAdminById);
router.put('/account/balance', techAdminAndAboveAuth, addBalance);
router.put('/account/user-lock', techAdminAndAboveAuth, lockUserAndDownlineMultiTable);

export default router;