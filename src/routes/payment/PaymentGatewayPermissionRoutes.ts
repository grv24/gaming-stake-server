import express from 'express';
import {
  grantPaymentGatewayPermissions,
  getUserPaymentGatewayPermissions,
  assignGatewayToUser,
  getAssignedGateways,
  removeGatewayAssignment,
  getMyPaymentGatewayPermissions,
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

// Gateway Assignment Routes
router.post('/assign-gateway', adminAndAboveAuth, assignGatewayToUser);
router.get('/assigned-gateways/:userId', adminAndAboveAuth, getAssignedGateways);
router.delete('/remove-assignment/:assignmentId', adminAndAboveAuth, removeGatewayAssignment);

export default router;

