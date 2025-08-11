import { Router } from 'express';
import { loginDeveloper, createDeveloper, getDevelopers } from '../../controllers/users/DeveloperController';

const router = Router();

router.post('/login', loginDeveloper);
router.post('/new-account', createDeveloper);
router.get('/get-accounts', getDevelopers);

export default router;
