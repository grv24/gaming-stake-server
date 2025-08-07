import { Router } from 'express';
import { createDeveloper, getDevelopers } from '../../controllers/users/DeveloperController';

const router = Router();

router.post('/new-account', createDeveloper);
router.get('/get-accounts', getDevelopers);

export default router;
