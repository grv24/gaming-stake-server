import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getWhitelists,
  createWhitelist,
  saveWhitelist,
  deleteWhitelist,
  getWhitelistByUrl
} from '../../controllers/whitelist/WhitelistController';
import {
  getWhitelistCasinoMappings,
  getActiveCasinosForWhitelist,
  addCasinoToWhitelist,
  updateCasinoMapping,
  removeCasinoFromWhitelist,
  bulkUpdateCasinoMappings
} from '../../controllers/whitelist/WhitelistCasinoController';
import {
  configureAllCasinosForWhitelist,
  getWhitelistByName
} from '../../controllers/whitelist/WhitelistBulkController';
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
router.get("/single", getWhitelistByUrl);
router.post(
  '/',
  developerAuth,
  upload.single('Logo'),
  createWhitelist
);
router.put(
  '/:id',
  developerAuth,
  upload.single('Logo'),
  saveWhitelist
);
router.delete('/:id', developerAuth, deleteWhitelist);

// Casino management routes for whitelist panels
router.get('/:whitelistId/casinos', developerAuth, getWhitelistCasinoMappings);
router.get('/:whitelistId/casinos/active', getActiveCasinosForWhitelist);
router.post('/:whitelistId/casinos', developerAuth, addCasinoToWhitelist);
router.put('/:whitelistId/casinos/bulk', developerAuth, bulkUpdateCasinoMappings);
router.patch('/casinos/:mappingId', developerAuth, updateCasinoMapping);
router.delete('/casinos/:mappingId', developerAuth, removeCasinoFromWhitelist);

// Bulk operations
router.post('/:whitelistId/configure-all-casinos', developerAuth, configureAllCasinosForWhitelist);
router.get('/name/:name', getWhitelistByName);

export default router;