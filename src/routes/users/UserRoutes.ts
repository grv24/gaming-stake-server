import express from 'express';
import { getUserIp } from '../../controllers/users/UserControllers';

const router = express.Router();

router.get('/fetch-ip', getUserIp);

export default router;