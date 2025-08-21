import express from 'express';
import { getAllTechAdmin, getTechAdminById, createTechAdmin, techAdminLogin, changeOwnPassword } from '../../controllers/users/TechAdminController';
import { addBalance, lockUserAndDownlineMultiTable } from "../../controllers/users/UserControllers";
import { developerAuth, techAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/login', techAdminLogin);
router.post('/new-account', developerAuth, createTechAdmin);
router.get('/get-accounts', paginationValidation, getAllTechAdmin);
router.get('/get-accounts/:id', paginationValidation, getTechAdminById);
router.put('/account/balance', developerAuth, addBalance);
router.put('/account/user-lock', developerAuth, lockUserAndDownlineMultiTable);
router.patch('/change-own-password', techAdminAndAboveAuth, changeOwnPassword)


export default router;