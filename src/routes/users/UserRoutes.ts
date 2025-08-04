import { Router } from 'express';
import { createDeveloper, getDevelopers } from '../../controllers/users/DeveloperController';

const router = Router();

router.post('/developers', createDeveloper);
router.get('/developers', getDevelopers);

export default router;
