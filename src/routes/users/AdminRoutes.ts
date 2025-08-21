import express from 'express';
import { getAdminById, getAllAdmin, createAdmin, adminLogin, changeOwnPassword } from '../../controllers/users/AdminController';
import { adminAndAboveAuth, techAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/new-account', techAdminAndAboveAuth, createAdmin);
router.get('/get-accounts', paginationValidation, getAllAdmin);
router.get('/get-accounts/:id', paginationValidation, getAdminById);
router.put('/account/balance', techAdminAndAboveAuth, addBalance);
// router.put('/account/user-lock', techAdminAndAboveAuth, lockUserAndDownlineMultiTable);
router.patch('/change-own-password', adminAndAboveAuth, changeOwnPassword)


export default router;