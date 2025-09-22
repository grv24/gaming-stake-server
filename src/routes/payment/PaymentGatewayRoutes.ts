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

const router = express.Router();

// Payment Gateway Management Routes (All Admin Levels)
// These routes are accessible by all admin levels (Developer, TechAdmin, Admin, MiniAdmin, SuperMaster, Master, SuperAgent, Agent)

// Create Payment Gateway
router.post('/createpaymentgateway', 
  agentAndAboveAuth, // Any admin level can create gateways
  uploadMiddleware,
  createPaymentGateway
);

// Update Payment Gateway
router.patch('/updatepaymentgateway/:id',
  agentAndAboveAuth,
  uploadMiddleware,
  updatePaymentGateway
);

// Delete Payment Gateway
router.delete('/deletepaymentgateway/:id',
  agentAndAboveAuth,
  deletePaymentGateway
);

// Toggle Gateway Status
router.patch('/paymentgateway/activateDeactivate/:id',
  agentAndAboveAuth,
  toggleGatewayStatus
);

// Get Created Gateways (for admin users)
router.get('/paymentgateway/created/getall',
  agentAndAboveAuth,
  getCreatedGateways
);

// Deposit Request Routes

// Create Deposit Request (Client only)
router.post('/createdepositrequest',
  clientAuth,
  uploadPaymentProof,
  createDepositRequest
);

// Get My Deposit Requests (Client only)
router.get('/getmydepositrequest',
  clientAuth,
  getMyDepositRequests
);

// Get Assigned Gateways (Client only)
router.get('/paymentgateway/assigned/getall',
  clientAuth,
  getAssignedGateways
);

// Get Incoming Deposit Requests (Admin users)
router.get('/recievingDepositRequest',
  agentAndAboveAuth,
  getIncomingDepositRequests
);

// Update Deposit Request (Approve/Decline) (Admin users)
router.put('/updateDepositRequest/:requestId',
  agentAndAboveAuth,
  updateDepositRequest
);

export default router;

