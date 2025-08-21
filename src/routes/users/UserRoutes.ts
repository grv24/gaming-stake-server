import express from 'express';
import { getAllDownlineUsers, getUserIp } from '../../controllers/users/UserControllers';
import { clientAuth } from '../../middlewares/RoleAuth';

const router = express.Router();

router.get('/fetch-ip', getUserIp);
router.get('/my-downline-users', clientAuth, getAllDownlineUsers);

export default router;