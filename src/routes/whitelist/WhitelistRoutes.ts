import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getWhitelists,
  createWhitelist,
  deleteWhitelist
} from '../../controllers/whitelist/WhitelistController';
import { developerAuth } from '../../middlewares/RoleAuth';
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/WhiteListLogos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'whitelist-logo-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and SVG are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, 
    files: 1
  }
});

router.get('/', developerAuth, getWhitelists);
router.post(
  '/',
  developerAuth,
  upload.single('Logo'),
  createWhitelist
);
router.delete('/:id', developerAuth, deleteWhitelist);

export default router;