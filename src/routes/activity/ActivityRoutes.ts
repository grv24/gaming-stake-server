import express from 'express';
import {
  getUserActivityHistory,
  getBettingActivityHistory,
  getSessionStatistics,
  getPerformanceMetrics,
  getActivityAnalytics,
  getDownlineActivity
} from '../../controllers/activity/ActivityController';
import { clientAuth, adminAndAboveAuth } from '../../middlewares/RoleAuth';

const router = express.Router();

// User activity routes (authenticated users)
router.get('/user/history', clientAuth, getUserActivityHistory);
router.get('/betting/history', clientAuth, getBettingActivityHistory);
router.get('/session/statistics', clientAuth, getSessionStatistics);
router.get('/analytics', clientAuth, getActivityAnalytics);

// Admin routes
router.get('/performance/metrics', adminAndAboveAuth, getPerformanceMetrics);
router.get('/downline/activity', adminAndAboveAuth, getDownlineActivity);

export default router;
