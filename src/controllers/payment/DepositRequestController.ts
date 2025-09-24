import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { DepositRequest } from '../../entities/payment/DepositRequest';
import { PaymentGateway } from '../../entities/payment/PaymentGateway';
import { AccountTrasaction } from '../../entities/Transactions/AccountTransactions';
import { FileUpload } from '../../entities/payment/FileUpload';
import { USER_TABLES } from '../../Helpers/users/Roles';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for payment proof uploads with public directory structure
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/images/payment-gateways/payment-proofs/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + sanitizedName);
  }
});

export const uploadPaymentProof = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
}).single('paymentProof');

// Create Deposit Request
export const createDepositRequest = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { transactionNo, amount, gatewayId } = req.body;
    const clientId = req.user?.userId;
    const clientType = req.user?.__type;
    const uplineId = req.user?.uplineId;
    
    // Get user's loginId and groupId from database
    const user = await getUserById(req.user?.userId || req.user?.id);
    const loginId = user?.loginId || req.user?.userId || 'unknown';
    const groupId = user?.groupID || req.user?.groupId || null; // Allow null since no users have groupId
    
    // Get upline's type from database if uplineId exists
    let uplineType = req.user?.uplineType;
    if (uplineId && !uplineType) {
      const uplineUser = await getUserById(uplineId);
      uplineType = uplineUser?.__type || 'unknown';
    }
    
    const ipAddress = req.ip || req.connection.remoteAddress || '';

    // Validate required fields
    if (!transactionNo || !amount || !gatewayId) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Transaction number, amount, and gateway ID are required'
      });
    }

    // Validate amount
    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Amount must be a positive number'
      });
    }

    // Check if gateway exists and is active
    const paymentGatewayRepo = queryRunner.manager.getRepository(PaymentGateway);
    const gateway = await paymentGatewayRepo.findOne({
      where: { id: gatewayId, isActive: true }
    });

    if (!gateway) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Payment gateway not found or inactive'
      });
    }

    // Validate amount against gateway limits
    if (gateway.gatewayDetails?.minAmount && depositAmount < gateway.gatewayDetails.minAmount) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: `Amount must be at least ${gateway.gatewayDetails.minAmount}`
      });
    }
    
    if (gateway.gatewayDetails?.maxAmount && depositAmount > gateway.gatewayDetails.maxAmount) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: `Amount must not exceed ${gateway.gatewayDetails.maxAmount}`
      });
    }

    // Get client's current balance
    const userRepo = queryRunner.manager.getRepository(USER_TABLES[clientType]);
    const client = await userRepo.findOne({ where: { id: clientId } });

    if (!client) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Create deposit request
    const depositRequestRepo = queryRunner.manager.getRepository(DepositRequest);
    const fileUploadRepo = queryRunner.manager.getRepository(FileUpload);

    const depositRequest = depositRequestRepo.create({
      transactionNo,
      amount: depositAmount,
      balance: client.balance,
      ipAddress,
      status: 'Pending',
      uplineId,
      uplineType,
      clientId,
      clientType,
      gatewayId,
      gatewayMethod: {
        gatewayMethod: gateway.gatewayMethod,
        gatewayDetails: gateway.gatewayDetails
      },
      groupId,
      loginId
    });

    // Handle payment proof upload
    if (req.file) {
      // Store public URL instead of file path
      const publicUrl = `/images/payment-gateways/payment-proofs/${path.basename(req.file.path)}`;
      depositRequest.paymentProof = publicUrl;
      
      // Create file upload record
      const fileUpload = fileUploadRepo.create({
        fileName: req.file.originalname,
        filePath: req.file.path,
        publicUrl: publicUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadType: 'paymentProof',
        relatedEntityId: depositRequest.id,
        relatedEntityType: 'DepositRequest',
        uploadedBy: clientId,
        uploadedByType: clientType,
        groupId
      });
      await fileUploadRepo.save(fileUpload);
    }

    await depositRequestRepo.save(depositRequest);
    await queryRunner.commitTransaction();

    return res.status(201).json({
      success: true,
      message: 'Deposit request created successfully',
      data: depositRequest
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error creating deposit request:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

// Helper function to get user by ID from any user table
async function getUserById(userId: string, userType?: string): Promise<any> {
  if (userType && USER_TABLES[userType]) {
    const repo = AppDataSource.getRepository(USER_TABLES[userType]);
    return await repo.findOne({ where: { id: userId } });
  }

  // Search across all user types
  for (const [type, entity] of Object.entries(USER_TABLES)) {
    const repo = AppDataSource.getRepository(entity);
    const user = await repo.findOne({ where: { id: userId } });
    if (user) {
      user.__type = type;
      return user;
    }
  }

  return null;
}

// Get My Deposit Requests (for clients)
export const getMyDepositRequests = async (req: Request, res: Response) => {
  try {
    const clientId = req.user?.userId;
    const groupId = req.user?.groupId;

    const depositRequestRepo = AppDataSource.getRepository(DepositRequest);
    
    const requests = await depositRequestRepo.find({
      where: { clientId, groupId },
      order: { createdAt: 'DESC' },
      relations: ['gateway']
    });

    return res.status(200).json({
      success: true,
      data: requests
    });

  } catch (error: any) {
    console.error('Error fetching deposit requests:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get Incoming Deposit Requests (for admin users)
export const getIncomingDepositRequests = async (req: Request, res: Response) => {
  try {
    const uplineId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const searchValue = req.query.searchValue as string;

    if (!uplineId) {
      return res.status(400).json({
        success: false,
        error: 'User ID not found'
      });
    }

    const depositRequestRepo = AppDataSource.getRepository(DepositRequest);
    
    const queryBuilder = depositRequestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.gateway', 'gateway')
      .where('request.uplineId = :uplineId', { uplineId });

    // Add search functionality
    if (searchValue) {
      queryBuilder.andWhere(
        '(request.transactionNo ILIKE :search OR request.loginId ILIKE :search OR request.amount = :searchAmount)',
        { 
          search: `%${searchValue}%`,
          searchAmount: isNaN(Number(searchValue)) ? -1 : Number(searchValue)
        }
      );
    }

    const skip = (page - 1) * limit;
    const [requests, total] = await queryBuilder
      .orderBy('request.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error: any) {
    console.error('Error fetching incoming deposit requests:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update Deposit Request (Approve/Decline)
export const updateDepositRequest = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { requestId } = req.params;
    const { transactionPassword, status, reason } = req.body;
    const adminId = req.user?.userId;
    const adminType = req.user?.__type;
    const adminTransactionPassword = req.user?.transactionPassword;

    // Validate transaction password
    if (transactionPassword !== adminTransactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Incorrect transaction password'
      });
    }

    // Validate status
    if (!['Approved', 'Declined'].includes(status)) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Status must be either Approved or Declined'
      });
    }

    const depositRequestRepo = queryRunner.manager.getRepository(DepositRequest);
    const accountTransactionRepo = queryRunner.manager.getRepository(AccountTrasaction);

    // Find the deposit request
    const depositRequest = await depositRequestRepo.findOne({
      where: { id: requestId },
      relations: ['gateway']
    });

    if (!depositRequest) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Deposit request not found'
      });
    }

    if (!depositRequest.canBeProcessed()) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Deposit request has already been processed'
      });
    }

    if (status === 'Approved') {
      // Check admin balance
      const adminRepo = queryRunner.manager.getRepository(USER_TABLES[adminType]);
      const admin = await adminRepo.findOne({ where: { id: adminId } });

      if (!admin) {
        await queryRunner.rollbackTransaction();
        return res.status(404).json({
          success: false,
          error: 'Admin user not found'
        });
      }

      if (admin.balance < depositRequest.amount) {
        await queryRunner.rollbackTransaction();
        return res.status(400).json({
          success: false,
          error: 'Insufficient admin balance'
        });
      }

      // Get client
      const clientRepo = queryRunner.manager.getRepository(USER_TABLES[depositRequest.clientType]);
      const client = await clientRepo.findOne({ where: { id: depositRequest.clientId } });

      if (!client) {
        await queryRunner.rollbackTransaction();
        return res.status(404).json({
          success: false,
          error: 'Client not found'
        });
      }

      // Update balances (ensure integer values and proper number conversion)
      const adminBalanceNum = Number(admin.balance) || 0;
      const clientBalanceNum = Number(client.balance) || 0;
      const depositAmountNum = Number(depositRequest.amount) || 0;
      
      console.log('Balance calculation debug:', {
        adminBalance: admin.balance,
        adminBalanceNum,
        clientBalance: client.balance,
        clientBalanceNum,
        depositAmount: depositRequest.amount,
        depositAmountNum
      });
      
      const newAdminBalance = Math.floor(adminBalanceNum - depositAmountNum);
      const newClientBalance = Math.floor(clientBalanceNum + depositAmountNum);
      
      console.log('New balances:', {
        newAdminBalance,
        newClientBalance
      });

      await adminRepo.update(adminId, { balance: newAdminBalance });
      await clientRepo.update(depositRequest.clientId, { balance: newClientBalance });

      // Create account transaction
      const accountTransaction = accountTransactionRepo.create({
        uplineUserId: adminId,
        downlineUserId: depositRequest.clientId,
        remarks: `[PAYMENT-GATEWAY-DEPOSIT] ${depositRequest.gatewayMethod.gatewayMethod} - Transaction: ${depositRequest.transactionNo} - Amount: ${depositRequest.amount}`,
        type: 'payment-gateway-deposit',
        amount: depositRequest.amount,
        depositRequestId: depositRequest.id,
        gatewayId: depositRequest.gatewayId,
        balanceBefore: client.balance,
        balanceAfter: newClientBalance,
        groupId: depositRequest.groupId || 'default'
      });
      await accountTransactionRepo.save(accountTransaction);

      // Update deposit request
      depositRequest.approve(adminId, adminType);
    } else {
      // Decline the request
      depositRequest.decline(adminId, adminType, reason);
    }

    await depositRequestRepo.save(depositRequest);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `Deposit request ${status.toLowerCase()} successfully`,
      data: depositRequest
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error updating deposit request:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      requestId: req.params.requestId,
      adminId: req.user?.userId,
      adminType: req.user?.__type
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};


