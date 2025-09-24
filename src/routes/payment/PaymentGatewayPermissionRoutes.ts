import express from 'express';
import {
  grantPaymentGatewayPermissions,
  getUserPaymentGatewayPermissions,
  assignGatewayToUser,
  getAssignedGateways,
  removeGatewayAssignment,
  getMyPaymentGatewayPermissions,
  checkUserPaymentGatewayPermissions,
  debugTokenInfo,
} from '../../controllers/payment/PaymentGatewayPermissionController';
import { 
  adminAndAboveAuth, 
  techAdminAndAboveAuth, 
  developerAuth 
} from '../../middlewares/RoleAuth';

const router = express.Router();

// Permission Management Routes
router.post('/grant-permissions', adminAndAboveAuth, grantPaymentGatewayPermissions);
router.get('/user-permissions/:userId', adminAndAboveAuth, getUserPaymentGatewayPermissions);
router.get('/my-permissions', adminAndAboveAuth, getMyPaymentGatewayPermissions);
router.get('/check-permissions', adminAndAboveAuth, checkUserPaymentGatewayPermissions);
router.get('/check-permissions/:userId', adminAndAboveAuth, checkUserPaymentGatewayPermissions);
router.get('/check-permissions/:userId/:userType', adminAndAboveAuth, checkUserPaymentGatewayPermissions);

// Debug Routes
router.get('/debug-token', adminAndAboveAuth, debugTokenInfo);

// Gateway Assignment Routes
router.post('/assign-gateway', adminAndAboveAuth, assignGatewayToUser);
router.get('/assigned-gateways/:userId', adminAndAboveAuth, getAssignedGateways);
router.delete('/remove-assignment/:assignmentId', adminAndAboveAuth, removeGatewayAssignment);

export default router;

