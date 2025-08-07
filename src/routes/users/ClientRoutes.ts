import express from 'express';
import { getClientById, getAllClient, createClient } from '../../controllers/users/ClientController';
import { clientAuth } from '../../middlewares/RoleAuth';
import { paginationValidation } from '../../Helpers/Request/Validation';

const router = express.Router();

router.post('/new-account', clientAuth, createClient);
router.get('/get-accounts', paginationValidation, getAllClient);
router.get('/get-accounts/:id', paginationValidation, getClientById);

export default router;