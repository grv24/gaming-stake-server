import { Router } from 'express';
import { fetchIpAddress } from "../../controllers/auth/login";

const router = Router();

router.get('/fetchIpAddress', fetchIpAddress);

export default router;