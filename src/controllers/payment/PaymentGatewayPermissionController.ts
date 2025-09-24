import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
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

// Check specific user's payment gateway permissions with detailed info
export const checkUserPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { userId, userType } = req.params;
    const currentUser = req.user;

    // Debug logging
    console.log('Debug - Current user from token:', {
      userId: currentUser?.userId,
      userType: currentUser?.userType,
      hasUser: !!currentUser
    });

    // If no userId provided, use current user from token
    const targetUserId = userId || currentUser?.userId;
    const targetUserType = userType || currentUser?.userType;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required or valid token must be provided'
      });
    }

    if (!targetUserType) {
      return res.status(400).json({
        success: false,
        message: 'User type not found in token. Please ensure you are properly authenticated.'
      });
    }

    // Check if current user has permission to view permissions
    let currentUserData = null;
    try {
      const currentUserRepo = getUserRepository(currentUser?.userType || '');
      currentUserData = await currentUserRepo.findOne({
        where: { id: currentUser?.userId }
      });
    } catch (error) {
      console.error('Error getting current user data:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid user type in token. Please check your authentication.'
      });
    }

    // Allow users to check their own permissions, or admins to check others
    const canViewPermissions = currentUserData?.paymentGatewayPermissions?.canAssignGateways || 
                              currentUser?.userId === targetUserId;

    if (!canViewPermissions) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view payment gateway permissions'
      });
    }

    // Find user - if userType is provided, use it; otherwise search all types
    let userData = null;
    let foundUserType = null;

    if (targetUserType) {
      // Check specific user type
      try {
        const userRepo = getUserRepository(targetUserType);
        const user = await userRepo.findOne({ where: { id: targetUserId } });
        if (user) {
          userData = user;
          foundUserType = targetUserType;
        }
      } catch (error) {
        console.error('Error finding user by type:', error);
        return res.status(400).json({
          success: false,
          message: `Invalid user type: ${targetUserType}`
        });
      }
    } else {
      // Search across all user types
      for (const [type, entity] of Object.entries(USER_TABLES)) {
        try {
          const repo = AppDataSource.getRepository(entity);
          const user = await repo.findOne({ where: { id: targetUserId } });
          if (user) {
            userData = user;
            foundUserType = type;
            break;
          }
        } catch (error) {
          console.error(`Error searching user type ${type}:`, error);
          continue;
        }
      }
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's payment gateway permissions
    const permissions = userData.paymentGatewayPermissions || {};
    
    // Check if user has any payment gateway permissions
    const hasAnyPermissions = Object.values(permissions).some(value => value === true);
    
    // Get assigned gateways count
    const gatewayAssignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignedGatewaysCount = await gatewayAssignmentRepo.count({
      where: { 
        assignedToUserId: targetUserId,
        isActive: true 
      }
    });

    // Get created gateways count
    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const createdGatewaysCount = await paymentGatewayRepo.count({
      where: { 
        createdBy: targetUserId,
        isActive: true 
      }
    });

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        userType: foundUserType,
        userName: userData.userName || userData.loginId || 'Unknown',
        hasPaymentGatewayPermissions: hasAnyPermissions,
        permissions: {
          canCreateGateways: permissions.canCreateGateways || false,
          canManageGateways: permissions.canManageGateways || false,
          canAssignGateways: permissions.canAssignGateways || false,
          canProcessRequests: permissions.canProcessRequests || false
        },
        gatewayStats: {
          assignedGatewaysCount,
          createdGatewaysCount
        },
        permissionSummary: {
          canCreate: permissions.canCreateGateways || false,
          canManage: permissions.canManageGateways || false,
          canAssign: permissions.canAssignGateways || false,
          canProcess: permissions.canProcessRequests || false
        }
      }
    });

  } catch (error: any) {
    console.error('Error checking user payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


// Debug route to check token information
export const debugTokenInfo = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    res.json({
      success: true,
      debug: {
        hasUser: !!currentUser,
        userId: currentUser?.userId || 'Not found',
        userType: currentUser?.userType || 'Not found',
        userObject: currentUser || 'No user object',
        headers: {
          authorization: req.headers.authorization ? 'Present' : 'Missing',
          contentType: req.headers['content-type'] || 'Not set'
        }
      }
    });

  } catch (error: any) {
    console.error('Error in debug token info:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
