import express from 'express';
import { getAdminById, getAllAdmin, createAdmin } from '../../controllers/users/AdminController';
import { techAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';
import { addBalance } from '../../controllers/users/UserControllers';

const router = express.Router();

router.post('/new-account', techAdminAndAboveAuth, createAdmin);
router.get('/get-accounts', paginationValidation, getAllAdmin);
router.get('/get-accounts/:id', paginationValidation, getAdminById);
router.put('/account/balance', techAdminAndAboveAuth, addBalance);

export default router;