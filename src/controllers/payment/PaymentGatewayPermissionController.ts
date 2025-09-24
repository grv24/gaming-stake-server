import { Request, Response } from 'express';
import { AppDataSource } from '../../config/database';
import { USER_TABLES } from '../../Helpers/users/Roles';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { GatewayAssignment } from '../../entities/payment/GatewayAssignment';
import { PaymentGateway } from '../../entities/payment/PaymentGateway';
import { Admin } from '../../entities/users/AdminUser';
import { TechAdmin } from '../../entities/users/TechAdminUser';

// Helper to get repository based on user type
const getUserRepository = (userType: string) => {
  if (!USER_TABLES[userType]) {
    throw new Error(`Invalid user type: ${userType}`);
  }
  return AppDataSource.getRepository(USER_TABLES[userType]);
};

// Grant payment gateway permissions to a user via GatewayAssignment
export const grantPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { userId, userType, gatewayId, permissions, notes } = req.body;
    const currentUser = req.user;

    console.log('🔐 Granting permissions:', { userId, userType, gatewayId, permissions, notes });

    if (!userId || !userType || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, userType, permissions'
      });
    }

    // Validate permissions object
    const validPermissions = ['canCreateGateway', 'canManageGateway', 'canAssignGateway', 'canProcessRequests'];
    const hasValidPermissions = validPermissions.some(perm => permissions[perm] !== undefined);
    
    if (!hasValidPermissions) {
      return res.status(400).json({
        success: false,
        message: 'At least one permission must be specified'
      });
    }

    // Check if current user has deposit/withdraw access (payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId', 'groupID']
    });

    if (!currentUserData?.depositWithdrawlAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required for payment gateway permissions'
      });
    }

    // Handle gateway validation - allow empty gatewayId for general permissions
    let gateway = null;
    if (gatewayId && gatewayId.trim() !== '') {
      const gatewayRepo = AppDataSource.getRepository(PaymentGateway);
      gateway = await gatewayRepo.findOne({ where: { id: gatewayId } });

      if (!gateway) {
        return res.status(404).json({
          success: false,
          message: 'Payment gateway not found'
        });
      }
    }

    // Find target user
    const targetUserRepo = getUserRepository(userType);
    const targetUser = await targetUserRepo.findOne({ 
      where: { id: userId },
      select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess']
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Check if assignment already exists (only if gatewayId is provided)
    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    let existingAssignment = null;
    
    if (gatewayId && gatewayId.trim() !== '') {
      existingAssignment = await assignmentRepo.findOne({
        where: {
          gatewayId,
          assignedToUserId: userId,
          isActive: true
        }
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: 'Gateway is already assigned to this user'
        });
      }
    }

    // Use the permissions as provided by the user
    const finalPermissions = {
      canCreateGateway: permissions.canCreateGateway || false,
      canManageGateway: permissions.canManageGateway || false,
      canAssignGateway: permissions.canAssignGateway || false,
      canProcessRequests: permissions.canProcessRequests || false
    };

    console.log('🔐 Final permissions:', finalPermissions);

    // Create new gateway assignment with granular permissions
    const assignment = assignmentRepo.create({
      gatewayId: gatewayId && gatewayId.trim() !== '' ? gatewayId : null, // Use null for empty gatewayId
      assignedToUserId: userId,
      assignedToUserType: userType,
      assignedByUserId: currentUser?.userId || '',
      assignedByUserType: currentUser?.userType || '',
      groupId: currentUserData?.groupID || '',
      notes: notes || `Payment gateway permissions granted by ${currentUser?.userType}`,
      canCreateGateway: finalPermissions.canCreateGateway,
      canManageGateway: finalPermissions.canManageGateway,
      canAssignGateway: finalPermissions.canAssignGateway,
      canProcessRequests: finalPermissions.canProcessRequests,
      restrictions: permissions.restrictions || {
        maxGateways: 5,
        maxAmount: 10000,
        allowedGatewayTypes: ["UPI", "Bank Transfer"]
      }
    });

    await assignmentRepo.save(assignment);

    // Enable deposit/withdraw access for the target user
    targetUser.depositWithdrawlAccess = true;
    await targetUserRepo.save(targetUser);

    res.json({
      success: true,
      message: 'Payment gateway permissions granted successfully via assignment',
      data: {
        assignmentId: assignment.id,
        userId,
        userType,
        userName: targetUser.userName || targetUser.loginId,
        gatewayId: gatewayId || '',
        gatewayName: gateway?.gatewayMethod || 'General Permissions',
        hasDepositWithdrawAccess: true,
        permissions: {
          canCreateGateway: assignment.canCreateGateway,
          canManageGateway: assignment.canManageGateway,
          canAssignGateway: assignment.canAssignGateway,
          canProcessRequests: assignment.canProcessRequests
        },
        restrictions: assignment.restrictions,
        assignedBy: {
          userId: currentUser?.userId,
          userType: currentUser?.userType,
          userName: currentUser?.userName || currentUser?.loginId
        },
        assignmentInfo: assignment.getAssignmentInfo(),
        note: gatewayId ? 'Gateway-specific permissions granted' : 'General permissions granted (not tied to specific gateway)'
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

// Get user's payment gateway permissions via GatewayAssignment
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

    // Check if current user has deposit/withdraw access (payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    const hasBasicAccess = currentUserData?.depositWithdrawlAccess;
    const isOwnAccount = currentUser?.userId === userId;
    
    if (!hasBasicAccess && !isOwnAccount) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to view payment gateway permissions'
      });
    }

    // Find user across all user types
    let userData = null;
    let userType = null;

    for (const [type, entity] of Object.entries(USER_TABLES)) {
      const repo = AppDataSource.getRepository(entity);
      const user = await repo.findOne({ 
        where: { id: userId },
        select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess']
      });
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

    // Get user's gateway assignments
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
      data: {
        userId,
        userType,
        userName: userData.userName || userData.loginId,
        hasDepositWithdrawAccess: userData.depositWithdrawlAccess,
        hasPaymentGatewayPermissions: userData.depositWithdrawlAccess,
        gatewayAssignments: assignments.map(assignment => ({
          assignmentId: assignment.id,
          gatewayId: assignment.gatewayId,
          gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
          assignedBy: {
            userId: assignment.assignedByUserId,
            userType: assignment.assignedByUserType
          },
          notes: assignment.notes,
          createdAt: assignment.createdAt,
          assignmentInfo: assignment.getAssignmentInfo(),
          permissions: {
            canCreateGateway: assignment.canCreateGateway,
            canManageGateway: assignment.canManageGateway,
            canAssignGateway: assignment.canAssignGateway,
            canProcessRequests: assignment.canProcessRequests
          },
          restrictions: assignment.restrictions
        })),
        totalAssignments: assignments.length
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

    // Check if current user has deposit/withdraw access (basic payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    if (!currentUserData?.depositWithdrawlAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to assign gateways'
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

    // Check if current user has deposit/withdraw access (basic payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    const hasBasicAccess = currentUserData?.depositWithdrawlAccess;
    const isOwnAccount = currentUser?.userId === userId;
    
    if (!hasBasicAccess && !isOwnAccount) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to view gateway assignments'
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

    // Check if current user has deposit/withdraw access (basic payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    if (!currentUserData?.depositWithdrawlAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to remove gateway assignments'
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
      where: { id: currentUser.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has payment gateway permissions (depositWithdrawlAccess)
    const hasPaymentGatewayPermissions = userData.depositWithdrawlAccess;
    
    // For tech admins, they have automatic permissions if depositWithdrawlAccess is true
    let automaticPermissions = null;
    if (currentUser.userType === 'techAdmin' && userData.depositWithdrawlAccess) {
      automaticPermissions = {
        canCreateGateway: true,
        canManageGateway: true,
        canAssignGateway: true,
        canProcessRequests: true
      };
    }
    
    // Get assigned gateways with details (for admins who receive assignments)
    const gatewayAssignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignments = await gatewayAssignmentRepo.find({
      where: { 
        assignedToUserId: currentUser.userId,
        isActive: true 
      },
      relations: ['gateway'],
      order: { createdAt: 'DESC' }
    });

    // Get created gateways count (for tech admins who create gateways)
    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const createdGatewaysCount = await paymentGatewayRepo.count({
      where: { 
        createdBy: currentUser.userId,
        isActive: true 
      }
    });

    res.json({
      success: true,
      data: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        userName: userData.userName || userData.loginId,
        hasPaymentGatewayPermissions: hasPaymentGatewayPermissions,
        hasDepositWithdrawAccess: userData.depositWithdrawlAccess,
        automaticPermissions: automaticPermissions,
        gatewayStats: {
          assignedGatewaysCount: assignments.length,
          createdGatewaysCount: createdGatewaysCount
        },
        gatewayAssignments: assignments.map(assignment => ({
          assignmentId: assignment.id,
          gatewayId: assignment.gatewayId,
          gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
          assignedBy: {
            userId: assignment.assignedByUserId,
            userType: assignment.assignedByUserType
          },
          notes: assignment.notes,
          createdAt: assignment.createdAt,
          assignmentInfo: assignment.getAssignmentInfo(),
          permissions: {
            canCreateGateway: assignment.canCreateGateway,
            canManageGateway: assignment.canManageGateway,
            canAssignGateway: assignment.canAssignGateway,
            canProcessRequests: assignment.canProcessRequests
          },
          restrictions: assignment.restrictions
        })),
        note: currentUser.userType === 'techAdmin' && userData.depositWithdrawlAccess ? 
          'You have automatic permissions and can create/manage gateways' : 
          currentUser.userType === 'admin' && assignments.length > 0 ?
          'You have gateway assignments with specific permissions' :
          'You need depositWithdrawlAccess to be enabled for payment gateway permissions'
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

    // Check if current user has deposit/withdraw access (payment gateway permission)
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    const hasBasicAccess = currentUserData?.depositWithdrawlAccess;
    const isOwnAccount = currentUser?.userId === targetUserId;
    
    // Allow users to check their own permissions, or admins with access to check others
    const canViewPermissions = hasBasicAccess || isOwnAccount;

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

    // Check if user has payment gateway permissions (depositWithdrawlAccess)
    const hasPaymentGatewayPermissions = userData.depositWithdrawlAccess;
    
    // For tech admins, they have automatic permissions if depositWithdrawlAccess is true
    let automaticPermissions = null;
    if (foundUserType === 'techAdmin' && userData.depositWithdrawlAccess) {
      automaticPermissions = {
        canCreateGateway: true,
        canManageGateway: true,
        canAssignGateway: true,
        canProcessRequests: true
      };
    }
    
    // Get assigned gateways with details (for admins who receive assignments)
    const gatewayAssignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignments = await gatewayAssignmentRepo.find({
      where: { 
        assignedToUserId: targetUserId,
        isActive: true 
      },
      relations: ['gateway'],
      order: { createdAt: 'DESC' }
    });

    // Get created gateways count (for tech admins who create gateways)
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
        hasPaymentGatewayPermissions: hasPaymentGatewayPermissions,
        hasDepositWithdrawAccess: userData.depositWithdrawlAccess,
        automaticPermissions: automaticPermissions,
        gatewayStats: {
          assignedGatewaysCount: assignments.length,
          createdGatewaysCount
        },
        gatewayAssignments: assignments.map(assignment => ({
          assignmentId: assignment.id,
          gatewayId: assignment.gatewayId,
          gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
          assignedBy: {
            userId: assignment.assignedByUserId,
            userType: assignment.assignedByUserType
          },
          notes: assignment.notes,
          createdAt: assignment.createdAt,
          assignmentInfo: assignment.getAssignmentInfo(),
          permissions: {
            canCreateGateway: assignment.canCreateGateway,
            canManageGateway: assignment.canManageGateway,
            canAssignGateway: assignment.canAssignGateway,
            canProcessRequests: assignment.canProcessRequests
          },
          restrictions: assignment.restrictions
        }))
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


// Grant payment gateway permissions to admin by tech admin via GatewayAssignment
export const grantAdminPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    const { gatewayId, permissions, notes } = req.body;
    const currentUser = req.user;

    // Check if current user is tech admin
    if (currentUser?.userType !== 'techAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only tech admins can grant permissions to admins'
      });
    }

    if (!permissions) {
      return res.status(400).json({
        success: false,
        message: 'Permissions are required'
      });
    }

    // Handle gateway validation - allow empty gatewayId for general permissions
    let gateway = null;
    if (gatewayId && gatewayId.trim() !== '') {
      const gatewayRepo = AppDataSource.getRepository(PaymentGateway);
      gateway = await gatewayRepo.findOne({ where: { id: gatewayId } });

      if (!gateway) {
        return res.status(404).json({
          success: false,
          message: 'Payment gateway not found'
        });
      }
    }

    // Find the admin
    const adminRepo = AppDataSource.getRepository(Admin);
    const admin = await adminRepo.findOne({ 
      where: { id: adminId },
      select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess', 'groupID']
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Check if assignment already exists (only if gatewayId is provided)
    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    let existingAssignment = null;
    
    if (gatewayId && gatewayId.trim() !== '') {
      existingAssignment = await assignmentRepo.findOne({
        where: {
          gatewayId,
          assignedToUserId: adminId,
          isActive: true
        }
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: 'Gateway is already assigned to this admin'
        });
      }
    }

    // Create new gateway assignment with granular permissions
    const assignment = assignmentRepo.create({
      gatewayId: gatewayId && gatewayId.trim() !== '' ? gatewayId : null, // Use null for empty gatewayId
      assignedToUserId: adminId,
      assignedToUserType: 'admin',
      assignedByUserId: currentUser?.userId || '',
      assignedByUserType: currentUser?.userType || '',
      groupId: admin?.groupID || '',
      notes: notes || `Payment gateway permissions granted to admin by tech admin`,
      canCreateGateway: permissions.canCreateGateway || false,
      canManageGateway: permissions.canManageGateway || false,
      canAssignGateway: permissions.canAssignGateway || false,
      canProcessRequests: permissions.canProcessRequests || false,
      restrictions: permissions.restrictions || {
        maxGateways: 5,
        maxAmount: 10000,
        allowedGatewayTypes: ["UPI", "Bank Transfer"]
      }
    });

    await assignmentRepo.save(assignment);

    // Enable deposit/withdraw access for payment gateway permissions
    admin.depositWithdrawlAccess = true;
    await adminRepo.save(admin);

    res.json({
      success: true,
      message: 'Payment gateway permissions granted to admin successfully via assignment',
      data: {
        assignmentId: assignment.id,
        adminId: admin.id,
        adminName: admin.userName || admin.loginId,
        gatewayId: gatewayId || '',
        gatewayName: gateway?.gatewayMethod || 'General Permissions',
        hasDepositWithdrawAccess: true,
        permissions: {
          canCreateGateway: assignment.canCreateGateway,
          canManageGateway: assignment.canManageGateway,
          canAssignGateway: assignment.canAssignGateway,
          canProcessRequests: assignment.canProcessRequests
        },
        restrictions: assignment.restrictions,
        grantedBy: {
          userId: currentUser.userId,
          userType: currentUser.userType,
          userName: currentUser.userName || currentUser.loginId
        },
        assignmentInfo: assignment.getAssignmentInfo()
      }
    });

  } catch (error: any) {
    console.error('Error granting admin payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Grant payment gateway permissions to tech admin by developer (SIMPLIFIED)
export const grantTechAdminPaymentGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const { techAdminId } = req.params;
    const currentUser = req.user;

    // Check if current user is developer
    if (currentUser?.userType !== 'developer') {
      return res.status(403).json({
        success: false,
        message: 'Only developers can grant permissions to tech admins'
      });
    }

    // Find the tech admin
    const techAdminRepo = AppDataSource.getRepository(TechAdmin);
    const techAdmin = await techAdminRepo.findOne({ 
      where: { id: techAdminId },
      select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess', 'groupID']
    });

    if (!techAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Tech admin not found'
      });
    }

    // Enable deposit/withdraw access for payment gateway permissions
    techAdmin.depositWithdrawlAccess = true;
    await techAdminRepo.save(techAdmin);

    res.json({
      success: true,
      message: 'Payment gateway permissions granted to tech admin successfully',
      data: {
        techAdminId: techAdmin.id,
        techAdminName: techAdmin.userName || techAdmin.loginId,
        hasDepositWithdrawAccess: true,
        automaticPermissions: {
          canCreateGateway: true,
          canManageGateway: true,
          canAssignGateway: true,
          canProcessRequests: true
        },
        grantedBy: {
          userId: currentUser.userId,
          userType: currentUser.userType,
          userName: currentUser.userName || currentUser.loginId
        },
        note: 'Tech admin can now create gateways and manage permissions for admins'
      }
    });

  } catch (error: any) {
    console.error('Error granting tech admin payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all admins for tech admin to grant permissions
export const getAdminsForPermissionGrant = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    // Check if current user is tech admin
    if (currentUser?.userType !== 'techAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Only tech admins can view admins for permission granting'
      });
    }

    const adminRepo = AppDataSource.getRepository(Admin);
    const admins = await adminRepo.find({
      select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess'],
      where: { isActive: true }
    });

    // Get gateway assignments for each admin
    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const adminsWithAssignments = await Promise.all(
      admins.map(async (admin) => {
        const assignments = await assignmentRepo.find({
          where: {
            assignedToUserId: admin.id,
            isActive: true
          },
          relations: ['gateway'],
          order: { createdAt: 'DESC' }
        });

        return {
          id: admin.id,
          userName: admin.userName || admin.loginId,
          loginId: admin.loginId,
          isActive: admin.isActive,
          hasDepositWithdrawAccess: admin.depositWithdrawlAccess,
          hasPaymentGatewayPermissions: admin.depositWithdrawlAccess,
          gatewayAssignments: assignments.map(assignment => ({
            assignmentId: assignment.id,
            gatewayId: assignment.gatewayId,
            gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
            assignedBy: {
              userId: assignment.assignedByUserId,
              userType: assignment.assignedByUserType
            },
            notes: assignment.notes,
            createdAt: assignment.createdAt,
            permissions: {
              canCreateGateway: assignment.canCreateGateway,
              canManageGateway: assignment.canManageGateway,
              canAssignGateway: assignment.canAssignGateway,
              canProcessRequests: assignment.canProcessRequests
            },
            restrictions: assignment.restrictions
          })),
          totalAssignments: assignments.length
        };
      })
    );

    res.json({
      success: true,
      data: {
        admins: adminsWithAssignments
      }
    });

  } catch (error: any) {
    console.error('Error getting admins for permission grant:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all tech admins for developer to grant permissions
export const getTechAdminsForPermissionGrant = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;

    // Check if current user is developer
    if (currentUser?.userType !== 'developer') {
      return res.status(403).json({
        success: false,
        message: 'Only developers can view tech admins for permission granting'
      });
    }

    const techAdminRepo = AppDataSource.getRepository(TechAdmin);
    const techAdmins = await techAdminRepo.find({
      select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess'],
      where: { isActive: true }
    });

    // Get created gateways count for each tech admin (they create their own gateways)
    const paymentGatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const techAdminsWithStats = await Promise.all(
      techAdmins.map(async (techAdmin) => {
        const createdGatewaysCount = await paymentGatewayRepo.count({
          where: { 
            createdBy: techAdmin.id,
            isActive: true 
          }
        });

        // Tech admins have automatic permissions if depositWithdrawlAccess is true
        const automaticPermissions = techAdmin.depositWithdrawlAccess ? {
          canCreateGateway: true,
          canManageGateway: true,
          canAssignGateway: true,
          canProcessRequests: true
        } : null;

        return {
          id: techAdmin.id,
          userName: techAdmin.userName || techAdmin.loginId,
          loginId: techAdmin.loginId,
          isActive: techAdmin.isActive,
          hasDepositWithdrawAccess: techAdmin.depositWithdrawlAccess,
          hasPaymentGatewayPermissions: techAdmin.depositWithdrawlAccess,
          automaticPermissions: automaticPermissions,
          gatewayStats: {
            createdGatewaysCount: createdGatewaysCount,
            assignedGatewaysCount: 0 // Tech admins don't receive assignments
          },
          note: techAdmin.depositWithdrawlAccess ? 
            'Tech admin has automatic permissions and can create/manage gateways' : 
            'Tech admin needs depositWithdrawlAccess to be enabled'
        };
      })
    );

    res.json({
      success: true,
      data: {
        techAdmins: techAdminsWithStats
      }
    });

  } catch (error: any) {
    console.error('Error getting tech admins for permission grant:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update permissions for an existing gateway assignment
export const updateGatewayAssignmentPermissions = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { permissions, restrictions, notes } = req.body;
    const currentUser = req.user;

    if (!assignmentId || !permissions) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and permissions are required'
      });
    }

    // Check if current user has deposit/withdraw access
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    if (!currentUserData?.depositWithdrawlAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to update gateway assignment permissions'
      });
    }

    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignment = await assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: ['gateway']
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Gateway assignment not found'
      });
    }

    // Update permissions using the entity method
    assignment.setPermissions(permissions);
    
    if (restrictions) {
      assignment.restrictions = restrictions;
    }
    
    if (notes) {
      assignment.notes = notes;
    }

    await assignmentRepo.save(assignment);

    res.json({
      success: true,
      message: 'Gateway assignment permissions updated successfully',
      data: {
        assignmentId: assignment.id,
        gatewayId: assignment.gatewayId,
        gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
        assignedToUserId: assignment.assignedToUserId,
        assignedToUserType: assignment.assignedToUserType,
        permissions: assignment.getAllPermissions(),
        restrictions: assignment.restrictions,
        notes: assignment.notes,
        updatedBy: {
          userId: currentUser?.userId,
          userType: currentUser?.userType,
          userName: currentUser?.userName || currentUser?.loginId
        },
        assignmentInfo: assignment.getAssignmentInfo()
      }
    });

  } catch (error: any) {
    console.error('Error updating gateway assignment permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Manage gateway assignment (activate/deactivate)
export const manageGatewayAssignment = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { action } = req.body; // 'activate' or 'deactivate'
    const currentUser = req.user;

    if (!assignmentId || !action) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and action are required'
      });
    }

    if (!['activate', 'deactivate'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "activate" or "deactivate"'
      });
    }

    // Check if current user has deposit/withdraw access
    const currentUserRepo = getUserRepository(currentUser?.userType || '');
    const currentUserData = await currentUserRepo.findOne({
      where: { id: currentUser?.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId']
    });

    if (!currentUserData?.depositWithdrawlAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have deposit/withdraw access required to manage gateway assignments'
      });
    }

    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignment = await assignmentRepo.findOne({
      where: { id: assignmentId },
      relations: ['gateway']
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Gateway assignment not found'
      });
    }

    // Update assignment status
    if (action === 'activate') {
      assignment.activateAssignment();
    } else {
      assignment.deactivateAssignment();
    }

    await assignmentRepo.save(assignment);

    res.json({
      success: true,
      message: `Gateway assignment ${action}d successfully`,
      data: {
        assignmentId: assignment.id,
        gatewayId: assignment.gatewayId,
        gatewayName: assignment.gateway?.gatewayMethod || 'Unknown',
        assignedToUserId: assignment.assignedToUserId,
        assignedToUserType: assignment.assignedToUserType,
        isActive: assignment.isActive,
        assignmentInfo: assignment.getAssignmentInfo(),
        managedBy: {
          userId: currentUser?.userId,
          userType: currentUser?.userType,
          userName: currentUser?.userName || currentUser?.loginId
        }
      }
    });

  } catch (error: any) {
    console.error('Error managing gateway assignment:', error);
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

// Check gateway assignment permissions for all admin types
export const checkAllAdminPermissions = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;
    
    console.log('🔍 Checking permissions for all admin types...');
    
    // Define admin types and their hierarchy
    const adminTypes = [
      { type: 'developer', level: 1, name: 'Developer' },
      { type: 'techAdmin', level: 2, name: 'Tech Admin' },
      { type: 'admin', level: 3, name: 'Admin' },
      { type: 'miniAdmin', level: 4, name: 'Mini Admin' },
      { type: 'superMaster', level: 5, name: 'Super Master' },
      { type: 'master', level: 6, name: 'Master' },
      { type: 'superAgent', level: 7, name: 'Super Agent' },
      { type: 'agent', level: 8, name: 'Agent' },
      { type: 'client', level: 9, name: 'Client' }
    ];

    const permissionResults = [];

    for (const adminType of adminTypes) {
      try {
        // Get repository for this admin type
        const userRepo = getUserRepository(adminType.type);
        
        // Get all users of this type
        const users = await userRepo.find({
          select: ['id', 'userName', 'loginId', 'isActive', 'depositWithdrawlAccess', 'groupID'],
          take: 10 // Limit to first 10 for performance
        });

        const userPermissions = [];
        
        for (const user of users) {
          // Check basic deposit/withdraw access
          const hasDepositWithdrawAccess = user.depositWithdrawlAccess || false;
          
          // Check gateway assignments for this user
          const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
          const assignments = await assignmentRepo.find({
            where: { 
              assignedToUserId: user.id,
              isActive: true 
            },
            relations: ['gateway']
          });

          // Check created gateways
          const gatewayRepo = AppDataSource.getRepository(PaymentGateway);
          const createdGateways = await gatewayRepo.find({
            where: { createdBy: user.id },
            select: ['id', 'gatewayMethod', 'isActive', 'createdAt']
          });

          // Calculate permissions based on assignments and access
          const permissions = {
            canCreateGateway: hasDepositWithdrawAccess && (adminType.type === 'techAdmin' || adminType.type === 'developer'),
            canManageGateway: hasDepositWithdrawAccess,
            canAssignGateway: hasDepositWithdrawAccess && adminType.level <= 3, // Only top 3 levels
            canProcessRequests: hasDepositWithdrawAccess,
            hasActiveAssignments: assignments.length > 0,
            hasCreatedGateways: createdGateways.length > 0
          };

          userPermissions.push({
            userId: user.id,
            userName: user.userName,
            loginId: user.loginId,
            isActive: user.isActive,
            groupId: user.groupID,
            depositWithdrawlAccess: hasDepositWithdrawAccess,
            permissions,
            assignmentsCount: assignments.length,
            createdGatewaysCount: createdGateways.length,
            assignments: assignments.map(a => ({
              id: a.id,
              gatewayId: a.gatewayId,
              gatewayMethod: a.gateway?.gatewayMethod,
              canCreateGateway: a.canCreateGateway,
              canManageGateway: a.canManageGateway,
              canAssignGateway: a.canAssignGateway,
              canProcessRequests: a.canProcessRequests
            }))
          });
        }

        permissionResults.push({
          adminType: adminType.type,
          adminName: adminType.name,
          level: adminType.level,
          usersCount: users.length,
          users: userPermissions
        });

      } catch (error: any) {
        console.error(`Error checking permissions for ${adminType.type}:`, error);
        permissionResults.push({
          adminType: adminType.type,
          adminName: adminType.name,
          level: adminType.level,
          error: error.message,
          users: []
        });
      }
    }

    // Summary statistics
    const summary = {
      totalAdminTypes: adminTypes.length,
      totalUsers: permissionResults.reduce((sum, type) => sum + (type.usersCount || 0), 0),
      usersWithDepositAccess: permissionResults.reduce((sum, type) => 
        sum + (type.users || []).filter(u => u.depositWithdrawlAccess).length, 0),
      usersWithActiveAssignments: permissionResults.reduce((sum, type) => 
        sum + (type.users || []).filter(u => u.permissions?.hasActiveAssignments).length, 0),
      usersWithCreatedGateways: permissionResults.reduce((sum, type) => 
        sum + (type.users || []).filter(u => u.permissions?.hasCreatedGateways).length, 0)
    };

    res.json({
      success: true,
      message: 'Gateway assignment permissions checked for all admin types',
      data: {
        summary,
        adminTypes: permissionResults,
        currentUser: {
          userId: currentUser?.userId,
          userType: currentUser?.userType,
          userName: currentUser?.userName
        }
      }
    });

  } catch (error: any) {
    console.error('Error checking all admin permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get current user's gateway permissions only (for UI handling)
export const getMyGatewayPermissions = async (req: Request, res: Response) => {
  try {
    const currentUser = req.user;
    
    if (!currentUser?.userId || !currentUser?.userType) {
      return res.status(400).json({
        success: false,
        message: 'User information not found'
      });
    }

    // Get user data
    const userRepo = getUserRepository(currentUser.userType);
    const userData = await userRepo.findOne({
      where: { id: currentUser.userId },
      select: ['id', 'depositWithdrawlAccess', 'userName', 'loginId', 'groupID']
    });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user has deposit/withdraw access
    const hasDepositWithdrawAccess = userData.depositWithdrawlAccess || false;

    // Get gateway assignments for this user
    const assignmentRepo = AppDataSource.getRepository(GatewayAssignment);
    const assignments = await assignmentRepo.find({
      where: { 
        assignedToUserId: currentUser.userId,
        isActive: true 
      },
      relations: ['gateway'],
      order: { createdAt: 'DESC' }
    });

    // Get created gateways count
    const gatewayRepo = AppDataSource.getRepository(PaymentGateway);
    const createdGatewaysCount = await gatewayRepo.count({
      where: { 
        createdBy: currentUser.userId,
        isActive: true 
      }
    });

    // Calculate permissions based on user type and access
    let permissions = {
      canCreateGateway: false,
      canManageGateway: false,
      canAssignGateway: false,
      canProcessRequests: false
    };

    if (hasDepositWithdrawAccess) {
      // Tech Admin and Developer have automatic permissions
      if (currentUser.userType === 'techAdmin' || currentUser.userType === 'developer') {
        permissions = {
          canCreateGateway: true,
          canManageGateway: true,
          canAssignGateway: true,
          canProcessRequests: true
        };
      } else {
        // Other admin types get permissions from assignments
        permissions = {
          canCreateGateway: assignments.some(a => a.canCreateGateway),
          canManageGateway: assignments.some(a => a.canManageGateway),
          canAssignGateway: assignments.some(a => a.canAssignGateway),
          canProcessRequests: assignments.some(a => a.canProcessRequests)
        };
      }
    }

    res.json({
      success: true,
      data: {
        userId: currentUser.userId,
        userType: currentUser.userType,
        userName: userData.userName || userData.loginId,
        groupId: userData.groupID,
        hasDepositWithdrawAccess,
        permissions,
        stats: {
          assignedGatewaysCount: assignments.length,
          createdGatewaysCount,
          hasActiveAssignments: assignments.length > 0,
          hasCreatedGateways: createdGatewaysCount > 0
        },
        assignments: assignments.map(a => ({
          id: a.id,
          gatewayId: a.gatewayId,
          gatewayMethod: a.gateway?.gatewayMethod,
          permissions: {
            canCreateGateway: a.canCreateGateway,
            canManageGateway: a.canManageGateway,
            canAssignGateway: a.canAssignGateway,
            canProcessRequests: a.canProcessRequests
          }
        }))
      }
    });

  } catch (error: any) {
    console.error('Error getting my gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
