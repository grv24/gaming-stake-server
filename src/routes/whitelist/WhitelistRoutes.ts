import express from 'express';
import multer from 'multer';
import { addNewWhiteListDomain } from '../../controllers/whitelist/WhitelistController';
import { isDeveloper } from '../../middlewares/auth/auth';

const router = express.Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/WhiteListLogos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post(
  '/add/new/whitelist',
  isDeveloper,
  upload.single('Logo'),
  addNewWhiteListDomain
);

export default router;