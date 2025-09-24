import express from 'express';
import {
  grantPaymentGatewayPermissions,
  getUserPaymentGatewayPermissions,
  assignGatewayToUser,
  getAssignedGateways,
  removeGatewayAssignment,
  getMyPaymentGatewayPermissions,
  checkUserPaymentGatewayPermissions,
  grantAdminPaymentGatewayPermissions,
  grantTechAdminPaymentGatewayPermissions,
  getAdminsForPermissionGrant,
  getTechAdminsForPermissionGrant,
  updateGatewayAssignmentPermissions,
  manageGatewayAssignment,
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

// Hierarchical Permission Granting Routes
// Tech Admin grants permissions to Admin
router.post('/grant-admin-permissions/:adminId', techAdminAndAboveAuth, grantAdminPaymentGatewayPermissions);
router.get('/admins-for-grant', techAdminAndAboveAuth, getAdminsForPermissionGrant);

// Developer grants permissions to Tech Admin
router.post('/grant-techadmin-permissions/:techAdminId', developerAuth, grantTechAdminPaymentGatewayPermissions);
router.get('/techadmins-for-grant', developerAuth, getTechAdminsForPermissionGrant);

// Debug Routes
router.get('/debug-token', adminAndAboveAuth, debugTokenInfo);

// Gateway Assignment Routes
router.post('/assign-gateway', adminAndAboveAuth, assignGatewayToUser);
router.get('/assigned-gateways/:userId', adminAndAboveAuth, getAssignedGateways);
router.delete('/remove-assignment/:assignmentId', adminAndAboveAuth, removeGatewayAssignment);
router.put('/manage-assignment/:assignmentId', adminAndAboveAuth, manageGatewayAssignment);
router.put('/update-assignment-permissions/:assignmentId', adminAndAboveAuth, updateGatewayAssignmentPermissions);

export default router;

