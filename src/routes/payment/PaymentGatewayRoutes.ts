import express from 'express';
import { In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { PaymentGateway } from '../../entities/payment/PaymentGateway';
import { 
  createPaymentGateway,
  getCreatedGateways,
  getAssignedGateways,
  updatePaymentGateway,
  updatePaymentGatewayQrImage,
  deletePaymentGateway,
  toggleGatewayStatus,
  uploadMiddleware,
  uploadQrImageMiddleware,
  handleMulterError
} from '../../controllers/payment/PaymentGatewayController';
import {
  assignGatewayToUser,
  getAssignedGateways as getAssignedGatewaysForUser,
  removeGatewayAssignment,
  manageGatewayAssignment,
  checkUserPaymentGatewayPermissions,
  grantPaymentGatewayPermissions
} from '../../controllers/payment/PaymentGatewayPermissionController';
import { 
  createDepositRequest,
  getMyDepositRequests,
  getIncomingDepositRequests,
  updateDepositRequest,
  uploadPaymentProof
} from '../../controllers/payment/DepositRequestController';
import { 
  developerAuth,
  techAdminAndAboveAuth,
  adminAndAboveAuth,
  miniAdminAndAboveAuth,
  superMasterAndAboveAuth,
  masterAndAboveAuth,
  superAgentAndAboveAuth,
  agentAndAboveAuth,
  clientAuth
} from '../../middlewares/RoleAuth';
import { trackUserActivity, trackBalanceActivity } from '../../middlewares/ActivityTrackingMiddleware';

const router = express.Router();

// Payment Gateway Management Routes (All Admin Levels)
// These routes are accessible by all admin levels (Developer, TechAdmin, Admin, MiniAdmin, SuperMaster, Master, SuperAgent, Agent)

// Create Payment Gateway
router.post('/createpaymentgateway', 
  agentAndAboveAuth, // Any admin level can create gateways
  trackUserActivity('gateway_creation', 'Created payment gateway'),
  uploadMiddleware,
  handleMulterError,
  createPaymentGateway
);

// Update Payment Gateway
router.patch('/updatepaymentgateway/:id',
  agentAndAboveAuth,
  trackUserActivity('gateway_update', 'Updated payment gateway'),
  uploadMiddleware,
  handleMulterError,
  updatePaymentGateway
);

// Update QR Image Only
router.patch('/updatepaymentgateway/:id/qr-image',
  agentAndAboveAuth,
  trackUserActivity('gateway_qr_update', 'Updated payment gateway QR image'),
  uploadQrImageMiddleware,
  handleMulterError,
  updatePaymentGatewayQrImage
);

// Delete Payment Gateway
router.delete('/deletepaymentgateway/:id',
  agentAndAboveAuth,
  trackUserActivity('gateway_deletion', 'Deleted payment gateway'),
  deletePaymentGateway
);

// Toggle Gateway Status
router.patch('/paymentgateway/activateDeactivate/:id',
  agentAndAboveAuth,
  trackUserActivity('gateway_toggle', 'Activated/deactivated payment gateway'),
  toggleGatewayStatus
);

// Get Created Gateways (for admin users)
router.get('/paymentgateway/created/getall',
  agentAndAboveAuth,
  trackUserActivity('gateway_view', 'Viewed created payment gateways'),
  getCreatedGateways
);

// Deposit Request Routes

// Create Deposit Request (Client only)
router.post('/createdepositrequest',
  clientAuth,
  trackBalanceActivity('deposit'),
  uploadPaymentProof,
  createDepositRequest
);

// Get My Deposit Requests (Client only)
router.get('/getmydepositrequest',
  clientAuth,
  trackUserActivity('deposit_requests_view', 'Viewed own deposit requests'),
  getMyDepositRequests
);

// Get Assigned Gateways (Client only)
router.get('/paymentgateway/assigned/getall',
  clientAuth,
  trackUserActivity('gateway_view', 'Viewed assigned payment gateways'),
  getAssignedGateways
);

// Get Incoming Deposit Requests (Admin users)
router.get('/recievingDepositRequest',
  agentAndAboveAuth,
  trackUserActivity('deposit_requests_view', 'Viewed incoming deposit requests'),
  getIncomingDepositRequests
);

// Update Deposit Request (Approve/Decline) (Admin users)
router.put('/updateDepositRequest/:requestId',
  agentAndAboveAuth,
  trackUserActivity('deposit_request_update', 'Updated deposit request status'),
  updateDepositRequest
);

// Additional Payment Gateway Management Routes

// Get Single Payment Gateway by ID
router.get('/paymentgateway/:id',
  agentAndAboveAuth,
  trackUserActivity('gateway_view', 'Viewed single payment gateway'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const groupId = req.user?.groupId;
      
      const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
      
      const gateway = await paymentGatewayRepo.findOne({
        where: { id, createdBy: userId, groupId },
        relations: ['gatewayImage']
      });

      if (!gateway) {
        return res.status(404).json({
          success: false,
          error: 'Payment gateway not found'
        });
      }

      return res.status(200).json({
        success: true,
        data: gateway
      });

    } catch (error: any) {
      console.error('Error fetching payment gateway:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Gateway Assignment Routes (Admin users)
router.post('/assign-gateway',
  agentAndAboveAuth,
  trackUserActivity('gateway_assignment', 'Assigned payment gateway to user'),
  assignGatewayToUser
);

router.get('/assigned-gateways/:userId',
  agentAndAboveAuth,
  trackUserActivity('gateway_assignment_view', 'Viewed assigned gateways for user'),
  getAssignedGatewaysForUser
);

router.delete('/remove-assignment/:assignmentId',
  agentAndAboveAuth,
  trackUserActivity('gateway_assignment_removal', 'Removed gateway assignment'),
  removeGatewayAssignment
);

router.put('/manage-assignment/:assignmentId',
  agentAndAboveAuth,
  trackUserActivity('gateway_assignment_management', 'Managed gateway assignment'),
  manageGatewayAssignment
);

// Permission Management Routes
router.post('/grant-permissions',
  agentAndAboveAuth,
  trackUserActivity('permission_grant', 'Granted payment gateway permissions'),
  grantPaymentGatewayPermissions
);

router.get('/check-permissions/:userId',
  agentAndAboveAuth,
  trackUserActivity('permission_check', 'Checked user payment gateway permissions'),
  checkUserPaymentGatewayPermissions
);

// Bulk Operations Routes
router.patch('/paymentgateway/bulk-status',
  agentAndAboveAuth,
  trackUserActivity('gateway_bulk_status', 'Updated multiple gateway statuses'),
  async (req, res) => {
    try {
      const { gatewayIds, isActive } = req.body;
      const userId = req.user?.userId;
      const groupId = req.user?.groupId;

      if (!gatewayIds || !Array.isArray(gatewayIds)) {
        return res.status(400).json({
          success: false,
          error: 'Gateway IDs array is required'
        });
      }

      const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
      
      const result = await paymentGatewayRepo.update(
        { 
          id: In(gatewayIds), 
          createdBy: userId, 
          groupId 
        },
        { isActive: isActive }
      );

      return res.status(200).json({
        success: true,
        message: `Updated ${result.affected} gateway statuses`,
        data: { affected: result.affected }
      });

    } catch (error: any) {
      console.error('Error updating bulk gateway status:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

router.delete('/paymentgateway/bulk-delete',
  agentAndAboveAuth,
  trackUserActivity('gateway_bulk_delete', 'Deleted multiple payment gateways'),
  async (req, res) => {
    try {
      const { gatewayIds } = req.body;
      const userId = req.user?.userId;
      const groupId = req.user?.groupId;

      if (!gatewayIds || !Array.isArray(gatewayIds)) {
        return res.status(400).json({
          success: false,
          error: 'Gateway IDs array is required'
        });
      }

      const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
      
      const result = await paymentGatewayRepo.delete({
        id: In(gatewayIds),
        createdBy: userId,
        groupId
      });

      return res.status(200).json({
        success: true,
        message: `Deleted ${result.affected} payment gateways`,
        data: { affected: result.affected }
      });

    } catch (error: any) {
      console.error('Error bulk deleting gateways:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Gateway Statistics Route
router.get('/paymentgateway/stats',
  agentAndAboveAuth,
  trackUserActivity('gateway_stats', 'Viewed payment gateway statistics'),
  async (req, res) => {
    try {
      const userId = req.user?.userId;
      const groupId = req.user?.groupId;

      const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
      
      const [totalGateways, activeGateways, inactiveGateways] = await Promise.all([
        paymentGatewayRepo.count({ where: { createdBy: userId, groupId } }),
        paymentGatewayRepo.count({ where: { createdBy: userId, groupId, isActive: true } }),
        paymentGatewayRepo.count({ where: { createdBy: userId, groupId, isActive: false } })
      ]);

      return res.status(200).json({
        success: true,
        data: {
          total: totalGateways,
          active: activeGateways,
          inactive: inactiveGateways
        }
      });

    } catch (error: any) {
      console.error('Error fetching gateway statistics:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

export default router;

