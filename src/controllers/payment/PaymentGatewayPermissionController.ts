import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { USER_TABLES } from '../../Helpers/users/Roles';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { GatewayAssignment } from '../../entities/payment/GatewayAssignment';
import { PaymentGateway } from '../../entities/payment/PaymentGateway';

// Helper to get repository based on user type
const getUserRepository = (userType: string) => {
  if (!USER_TABLES[userType]) {
    throw new Error(`Invalid user type: ${userType}`);
  }
  return AppDataSource.getRepository(USER_TABLES[userType]);
};

// Grant payment gateway permissions to a user
export const grantPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { userId, userType, permissions } = req.body;
    const currentUser = req.user;

    if (!userId || !userType || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userType, permissions'
      });
    }

    // Validate permissions object
    const validPermissions = ['canCreateGateways', 'canManageGateways', 'canAssignGateways', 'canProcessRequests'];
    const hasValidPermissions = validPermissions.some(perm => permissions[perm] !== undefined);
    
    if (!hasValidPermissions) {
      return res.status(400).json({
        success: false,
        message: 'At least one permission must be specified'
      });
    }

    // Check if current user has permission to grant permissions
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId }
    });

    if (!currentUserData?.paymentGatewayPermissions?.canAssignGateways) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to grant payment gateway permissions'
      });
    }

    // Get target user repository and update permissions
    const targetUserRepo = getUserRepository(userType);
    const targetUser = await targetUserRepo.findOne({ where: { id: userId } });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Update permissions
    targetUser.paymentGatewayPermissions = {
      ...targetUser.paymentGatewayPermissions,
      ...permissions
    };

    await targetUserRepo.save(targetUser);

    res.json({
      success: true,
      message: 'Payment gateway permissions granted successfully',
      data: {
        userId,
        userType,
        permissions: targetUser.paymentGatewayPermissions
      }
    });

  } catch (error: any) {
    console.error('Error granting payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get user's payment gateway permissions
export const getUserPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if current user has permission to view permissions
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId }
    });

    if (!currentUserData?.paymentGatewayPermissions?.canAssignGateways && currentUser?.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view payment gateway permissions'
      });
    }

    // Find user across all user types
    let userData = null;
    let userType = null;

    for (const [type, entity] of Object.entries(USER_TABLES)) {
      const repo = AppDataSource.getRepository(entity);
      const user = await repo.findOne({ where: { id: userId } });
      if (user) {
        userData = user;
        userType = type;
        break;
      }
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId,
        userType,
        permissions: userData.paymentGatewayPermissions || {}
      }
    });

  } catch (error: any) {
    console.error('Error getting user payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Assign gateway to a user
export const assignGatewayToUser = async (req: Request, res: Response) => {
  try {
    const { gatewayId, assignedToUserId, assignedToUserType, notes } = req.body;
    const currentUser = req.user;

    if (!gatewayId || !assignedToUserId || !assignedToUserType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: gatewayId, assignedToUserId, assignedToUserType'
      });
    }

    // Check if current user has permission to assign gateways
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId }
    });

    if (!currentUserData?.paymentGatewayPermissions?.canAssignGateways) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign gateways'
      });
    }

    // Check if gateway exists
    const gatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const gateway = await gatewayRepo.findOne({ where: { id: gatewayId } });

    if (!gateway) {
      return res.status(404).json({
        success: false,
        message: 'Payment gateway not found'
      });
    }

    // Check if assignment already exists
    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const existingAssignment = await assignmentRepo.findOne({
      where: {
        gatewayId,
        assignedToUserId,
        isActive: true
      }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: 'Gateway is already assigned to this user'
      });
    }

    // Create new assignment
    const assignment = assignmentRepo.create({
      gatewayId,
      assignedToUserId,
      assignedToUserType,
      assignedByUserId: currentUser?.userId || '',
      assignedByUserType: currentUser?.userType || '',
      groupId: currentUserData?.groupID || '',
      notes: notes || null
    });

    await assignmentRepo.save(assignment);

    res.json({
      success: true,
      message: 'Gateway assigned successfully',
      data: {
        assignmentId: assignment.id,
        gatewayId,
        assignedToUserId,
        assignedToUserType
      }
    });

  } catch (error: any) {
    console.error('Error assigning gateway to user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get assigned gateways for a user
export const getAssignedGateways = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    // Check if current user has permission to view assignments
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId }
    });

    if (!currentUserData?.paymentGatewayPermissions?.canAssignGateways && currentUser?.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view gateway assignments'
      });
    }

    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignments = await assignmentRepo.find({
      where: {
        assignedToUserId: userId,
        isActive: true
      },
      relations: ['gateway'],
      order: { createdAt: 'DESC' }
    });

    res.json({
      success: true,
      data: assignments.map(assignment => ({
        id: assignment.id,
        gateway: assignment.gateway,
        assignedBy: {
          userId: assignment.assignedByUserId,
          userType: assignment.assignedByUserType
        },
        notes: assignment.notes,
        createdAt: assignment.createdAt
      }))
    });

  } catch (error: any) {
    console.error('Error getting assigned gateways:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Remove gateway assignment
export const removeGatewayAssignment = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const currentUser = req.user;

    if (!assignmentId) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID is required'
      });
    }

    // Check if current user has permission to remove assignments
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId }
    });

    if (!currentUserData?.paymentGatewayPermissions?.canAssignGateways) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove gateway assignments'
      });
    }

    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignment = await assignmentRepo.findOne({
      where: { id: assignmentId }
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Gateway assignment not found'
      });
    }

    // Deactivate assignment instead of deleting
    assignment.isActive = false;
    await assignmentRepo.save(assignment);

    res.json({
      success: true,
      message: 'Gateway assignment removed successfully'
    });

  } catch (error: any) {
    console.error('Error removing gateway assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get my permissions (for current user)
export const getMyPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    if (!currentUser?.userId || !currentUser?.userType) {
      return res.status(400).json({
        success: false,
        message: 'User information not found'
      });
    }

    const userRepo = getUserRepository(currentUser.userType);
    const userData = await userRepo.findOne({
      where: { id: currentUser.userId }
    });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        permissions: userData.paymentGatewayPermissions || {}
      }
    });

  } catch (error: any) {
    console.error('Error getting my payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

