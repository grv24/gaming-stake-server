import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { PaymentGateway } from '../../entities/payment/PaymentGateway';
import { FileUpload } from '../../entities/payment/FileUpload';
import { GatewayAssignment } from '../../entities/payment/GatewayAssignment';
import { USER_TABLES } from '../../Helpers/users/Roles';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Helper to get repository based on user type
const getUserRepository = (userType: string) => {
  if (!USER_TABLES[userType]) {
    throw new Error(`Invalid user type: ${userType}`);
  }
  return AppDataSource.getRepository(USER_TABLES[userType]);
};

// Helper to check payment gateway permissions
const checkPaymentGatewayPermission = async (userId: string, userType: string, permission: string): Promise<boolean> => {
  try {
    const userRepo = getUserRepository(userType);
    const user = await userRepo.findOne({ 
      where: { id: userId },
      select: ['id', 'depositWithdrawlAccess']
    });
    
    if (!user) {
      console.log('User not found:', { userId, userType });
      return false;
    }
    
    console.log('User found:', { 
      userId, 
      userType, 
      depositWithdrawlAccess: user.depositWithdrawlAccess 
    });
    
    // For tech admins, they have automatic permissions if depositWithdrawlAccess is true
    if (userType === 'techAdmin' && user.depositWithdrawlAccess) {
      console.log('Tech admin with depositWithdrawlAccess - granting permission');
      return true; // Tech admins have all permissions automatically
    }
    
    // For other user types, check if they have depositWithdrawlAccess
    if (user.depositWithdrawlAccess) {
      console.log('User with depositWithdrawlAccess - granting permission');
      return true;
    }
    
    console.log('User does not have depositWithdrawlAccess - denying permission');
    return false;
  } catch (error) {
    console.error('Error checking payment gateway permission:', error);
    return false;
  }
};

// Configure multer for file uploads with public directory structure
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'public/images/payment-gateways/';
    
    // Determine subdirectory based on file field
    if (file.fieldname === 'gatewayImage') {
      uploadPath += 'gateway-images/';
    } else if (file.fieldname === 'qrImage') {
      uploadPath += 'qr-codes/';
    } else if (file.fieldname === 'paymentProof') {
      uploadPath += 'payment-proofs/';
    } else {
      uploadPath += 'misc/';
    }
    
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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Error handling middleware for multer
const handleMulterError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected field in form data',
        message: `Field '${error.field}' is not expected. Expected fields: gatewayImage, qrImage`,
        expectedFields: ['gatewayImage', 'qrImage']
      });
    }
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: 'File size exceeds 5MB limit'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Maximum 1 file per field allowed'
      });
    }
  }
  next(error);
};

export const uploadMiddleware = upload.fields([
  { name: 'gatewayImage', maxCount: 1 },
  { name: 'qrImage', maxCount: 1 }
]);

export { handleMulterError };

// Create Payment Gateway
export const createPaymentGateway = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { gatewayMethod, gatewayDetails } = req.body;
    const createdBy = req.user?.userId;
    const createdByType = req.user?.__type;
    const groupId = req.user?.groupId;

    // Check permission to create gateways
    if (!createdBy || !createdByType) {
      await queryRunner.rollbackTransaction();
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const hasPermission = await checkPaymentGatewayPermission(createdBy, createdByType, 'canCreateGateway');
    
    // Debug logging
    console.log('Payment Gateway Permission Check:', {
      userId: createdBy,
      userType: createdByType,
      permission: 'canCreateGateway',
      hasPermission: hasPermission
    });
    
    if (!hasPermission) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to create payment gateways',
        debug: {
          userId: createdBy,
          userType: createdByType,
          permission: 'canCreateGateway'
        }
      });
    }

    // Validate required fields
    if (!gatewayMethod || !gatewayDetails) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Gateway method and details are required'
      });
    }

    // Parse gateway details if it's a string
    let parsedGatewayDetails;
    try {
      parsedGatewayDetails = typeof gatewayDetails === 'string' 
        ? JSON.parse(gatewayDetails) 
        : gatewayDetails;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Invalid gateway details format'
      });
    }

    // Create payment gateway
    const paymentGatewayRepo = queryRunner.manager.getRepository(PaymentGateway);
    const fileUploadRepo = queryRunner.manager.getRepository(FileUpload);

    const gateway = paymentGatewayRepo.create({
      gatewayMethod,
      gatewayDetails: parsedGatewayDetails,
      isActive: true,
      createdBy,
      createdByType,
      groupId
    });

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (files?.gatewayImage?.[0]) {
      const gatewayImageFile = files.gatewayImage[0];
      // Store public URL instead of file path
      const publicUrl = `/images/payment-gateways/gateway-images/${path.basename(gatewayImageFile.path)}`;
      gateway.gatewayImage = publicUrl;
      
      // Create file upload record
      try {
        const fileUpload = fileUploadRepo.create({
          fileName: gatewayImageFile.originalname,
          filePath: gatewayImageFile.path,
          publicUrl: publicUrl,
          fileType: gatewayImageFile.mimetype,
          fileSize: gatewayImageFile.size,
          uploadType: 'gatewayImage',
          relatedEntityId: gateway.id,
          relatedEntityType: 'PaymentGateway',
          uploadedBy: createdBy,
          uploadedByType: createdByType,
          groupId
        });
        await fileUploadRepo.save(fileUpload);
        console.log('Gateway image file upload record created successfully');
      } catch (fileError) {
        console.error('Error creating gateway image file upload record:', fileError);
        // Continue without failing the entire request
      }
    }

    if (files?.qrImage?.[0]) {
      const qrImageFile = files.qrImage[0];
      // Store public URL instead of file path
      const publicUrl = `/images/payment-gateways/qr-codes/${path.basename(qrImageFile.path)}`;
      gateway.qrImage = publicUrl;
      
      // Create file upload record
      try {
        const fileUpload = fileUploadRepo.create({
          fileName: qrImageFile.originalname,
          filePath: qrImageFile.path,
          publicUrl: publicUrl,
          fileType: qrImageFile.mimetype,
          fileSize: qrImageFile.size,
          uploadType: 'qrImage',
          relatedEntityId: gateway.id,
          relatedEntityType: 'PaymentGateway',
          uploadedBy: createdBy,
          uploadedByType: createdByType,
          groupId
        });
        await fileUploadRepo.save(fileUpload);
        console.log('QR image file upload record created successfully');
      } catch (fileError) {
        console.error('Error creating QR image file upload record:', fileError);
        // Continue without failing the entire request
      }
    }

    await paymentGatewayRepo.save(gateway);
    await queryRunner.commitTransaction();

    return res.status(201).json({
      success: true,
      message: 'Payment gateway created successfully',
      data: gateway
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error creating payment gateway:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

// Get Created Gateways (for admin users)
export const getCreatedGateways = async (req: Request, res: Response) => {
  try {
    const createdBy = req.user?.userId;
    const groupId = req.user?.groupId;

    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
    
    const gateways = await paymentGatewayRepo.find({
      where: { createdBy, groupId },
      order: { createdAt: 'DESC' }
    });

    return res.status(200).json({
      success: true,
      data: gateways
    });

  } catch (error: any) {
    console.error('Error fetching created gateways:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get Assigned Gateways (for clients)
export const getAssignedGateways = async (req: Request, res: Response) => {
  try {
    const clientId = req.user?.userId;
    const clientType = req.user?.__type;
    const uplineId = req.user?.uplineId;
    const uplineType = req.user?.uplineType;
    const groupId = req.user?.groupId;

    if (!clientId || !uplineId) {
      return res.status(400).json({
        success: false,
        error: 'Client authentication required'
      });
    }

    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const gatewayAssignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    
    let gateways: PaymentGateway[] = [];

    // Priority 1: Check for explicit gateway assignments by upline
    const explicitAssignments = await gatewayAssignmentRepo.find({
      where: {
        assignedToUserId: clientId,
        assignedToUserType: clientType,
        assignedByUserId: uplineId,
        assignedByUserType: uplineType,
        groupId,
        isActive: true
      },
      relations: ['gateway']
    });

    if (explicitAssignments.length > 0) {
      // Use explicitly assigned gateways
      gateways = explicitAssignments
        .map(assignment => assignment.gateway)
        .filter(gateway => gateway && gateway.isActive);
      
      console.log(`Found ${gateways.length} explicitly assigned gateways for client ${clientId}`);
    } else {
      // Priority 2: Fallback to gateways created by upline
      const uplineGateways = await paymentGatewayRepo.find({
        where: { 
          createdBy: uplineId, 
          groupId,
          isActive: true 
        },
        order: { createdAt: 'DESC' }
      });
      
      gateways = uplineGateways;
      console.log(`No explicit assignments found, using ${gateways.length} upline-created gateways for client ${clientId}`);
    }

    return res.status(200).json({
      success: true,
      data: gateways,
      assignmentType: explicitAssignments.length > 0 ? 'explicit' : 'inherited'
    });

  } catch (error: any) {
    console.error('Error fetching assigned gateways:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Update Payment Gateway
export const updatePaymentGateway = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;
    const { gatewayMethod, gatewayDetails } = req.body;
    const userId = req.user?.userId;
    const userType = req.user?.__type;
    const groupId = req.user?.groupId;

    // Check permission to manage gateways
    if (!userId || !userType) {
      await queryRunner.rollbackTransaction();
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const hasPermission = await checkPaymentGatewayPermission(userId, userType, 'canManageGateway');
    if (!hasPermission) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage payment gateways'
      });
    }

    const paymentGatewayRepo = queryRunner.manager.getRepository(PaymentGateway);
    const fileUploadRepo = queryRunner.manager.getRepository(FileUpload);

    // Find the gateway
    const gateway = await paymentGatewayRepo.findOne({
      where: { id, createdBy: userId, groupId }
    });

    if (!gateway) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    // Update fields
    if (gatewayMethod) gateway.gatewayMethod = gatewayMethod;
    if (gatewayDetails) {
      const parsedDetails = typeof gatewayDetails === 'string' 
        ? JSON.parse(gatewayDetails) 
        : gatewayDetails;
      gateway.gatewayDetails = parsedDetails;
    }

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (files?.gatewayImage?.[0]) {
      // Delete old file if exists
      if (gateway.gatewayImage) {
        const oldFilePath = gateway.gatewayImage.replace('/images/payment-gateways/gateway-images/', 'public/images/payment-gateways/gateway-images/');
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      const gatewayImageFile = files.gatewayImage[0];
      // Store public URL instead of file path
      const publicUrl = `/images/payment-gateways/gateway-images/${path.basename(gatewayImageFile.path)}`;
      gateway.gatewayImage = publicUrl;
      
      // Update file upload record
      await fileUploadRepo.update(
        { relatedEntityId: id, uploadType: 'gatewayImage' },
        {
          fileName: gatewayImageFile.originalname,
          filePath: gatewayImageFile.path,
          publicUrl: publicUrl,
          fileType: gatewayImageFile.mimetype,
          fileSize: gatewayImageFile.size
        }
      );
    }

    if (files?.qrImage?.[0]) {
      // Delete old file if exists
      if (gateway.qrImage) {
        const oldFilePath = gateway.qrImage.replace('/images/payment-gateways/qr-codes/', 'public/images/payment-gateways/qr-codes/');
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      
      const qrImageFile = files.qrImage[0];
      // Store public URL instead of file path
      const publicUrl = `/images/payment-gateways/qr-codes/${path.basename(qrImageFile.path)}`;
      gateway.qrImage = publicUrl;
      
      // Update file upload record
      await fileUploadRepo.update(
        { relatedEntityId: id, uploadType: 'qrImage' },
        {
          fileName: qrImageFile.originalname,
          filePath: qrImageFile.path,
          publicUrl: publicUrl,
          fileType: qrImageFile.mimetype,
          fileSize: qrImageFile.size
        }
      );
    }

    await paymentGatewayRepo.save(gateway);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Payment gateway updated successfully',
      data: gateway
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error updating payment gateway:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

// Delete Payment Gateway
export const deletePaymentGateway = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userType = req.user?.__type;
    const groupId = req.user?.groupId;

    // Check permission to manage gateways
    if (!userId || !userType) {
      await queryRunner.rollbackTransaction();
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const hasPermission = await checkPaymentGatewayPermission(userId, userType, 'canManageGateway');
    if (!hasPermission) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage payment gateways'
      });
    }

    const paymentGatewayRepo = queryRunner.manager.getRepository(PaymentGateway);
    const fileUploadRepo = queryRunner.manager.getRepository(FileUpload);

    // Find the gateway
    const gateway = await paymentGatewayRepo.findOne({
      where: { id, createdBy: userId, groupId }
    });

    if (!gateway) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    // Delete associated files
    if (gateway.gatewayImage && fs.existsSync(gateway.gatewayImage)) {
      fs.unlinkSync(gateway.gatewayImage);
    }
    if (gateway.qrImage && fs.existsSync(gateway.qrImage)) {
      fs.unlinkSync(gateway.qrImage);
    }

    // Delete file upload records
    await fileUploadRepo.delete({ relatedEntityId: id });

    // Delete the gateway
    await paymentGatewayRepo.remove(gateway);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Payment gateway deleted successfully'
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error deleting payment gateway:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    await queryRunner.release();
  }
};

// Toggle Gateway Status
export const toggleGatewayStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userType = req.user?.__type;
    const groupId = req.user?.groupId;

    // Check permission to manage gateways
    if (!userId || !userType) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const hasPermission = await checkPaymentGatewayPermission(userId, userType, 'canManageGateway');
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to manage payment gateways'
      });
    }

    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);

    const gateway = await paymentGatewayRepo.findOne({
      where: { id, createdBy: userId, groupId }
    });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        error: 'Payment gateway not found'
      });
    }

    gateway.isActive = !gateway.isActive;
    await paymentGatewayRepo.save(gateway);

    return res.status(200).json({
      success: true,
      message: `Payment gateway ${gateway.isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive: gateway.isActive }
    });

  } catch (error: any) {
    console.error('Error toggling gateway status:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
