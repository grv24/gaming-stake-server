import express from 'express';
import { 
  createPaymentGateway,
  getCreatedGateways,
  getAssignedGateways,
  updatePaymentGateway,
  deletePaymentGateway,
  toggleGatewayStatus,
  uploadMiddleware
} from '../../controllers/payment/PaymentGatewayController';
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
  createPaymentGateway
);

// Update Payment Gateway
router.patch('/updatepaymentgateway/:id',
  agentAndAboveAuth,
  trackUserActivity('gateway_update', 'Updated payment gateway'),
  uploadMiddleware,
  updatePaymentGateway
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

export default router;

