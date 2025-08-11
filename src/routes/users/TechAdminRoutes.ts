import express from 'express';
import { getAllTechAdmin, getTechAdminById, createTechAdmin, techAdminLogin } from '../../controllers/users/TechAdminController';
import { techAdminAndAboveAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/login', techAdminLogin);
router.post('/new-account', techAdminAndAboveAuth, createTechAdmin);
router.get('/get-accounts', paginationValidation, getAllTechAdmin);
router.get('/get-accounts/:id', paginationValidation, getTechAdminById);

export default router;