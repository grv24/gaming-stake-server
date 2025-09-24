// WORKAROUND: Payment Gateway Permissions without database column
// This controller works around the missing paymentGatewayPermissions column

import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { Admin } from '../entities/users/AdminUser';
import { TechAdmin } from '../entities/users/TechAdminUser';

// In-memory storage for permissions (temporary solution)
const permissionsStore = new Map<string, any>();

export const grantTechAdminPaymentGatewayPermissionsWorkaround = async (req: Request, res: Response) => {
  try {
    const { techAdminId } = req.params;
    const { permissions } = req.body;
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
      select: ['id', 'userName', 'loginId', 'isActive']
    });

    if (!techAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Tech admin not found'
      });
    }

    // Store permissions in memory (temporary solution)
    permissionsStore.set(`techadmin_${techAdminId}`, {
      ...permissions,
      grantedBy: currentUser.userId,
      grantedAt: new Date(),
      grantedByType: currentUser.userType
    });

    res.json({
      success: true,
      message: 'Payment gateway permissions granted to tech admin successfully (workaround)',
      data: {
        techAdminId: techAdmin.id,
        techAdminName: techAdmin.userName || techAdmin.loginId,
        permissions: {
          canCreateGateway: permissions.canCreateGateway || false,
          canManageGateway: permissions.canManageGateway || false,
          canAssignGateway: permissions.canAssignGateway || false,
          canProcessRequests: permissions.canProcessRequests || false,
          restrictions: permissions.restrictions || {
            maxGateways: 5,
            maxAmount: 10000,
            allowedGatewayTypes: ["UPI", "Bank Transfer"]
          }
        },
        grantedBy: {
          userId: currentUser.userId,
          userType: currentUser.userType,
          userName: currentUser.userName || currentUser.loginId
        },
        note: 'Permissions stored temporarily - database column needs to be added by admin'
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

export const checkUserPaymentGatewayPermissionsWorkaround = async (req: Request, res: Response) => {
  try {
    const { userId, userType } = req.params;
    const currentUser = req.user;

    const targetUserId = userId || currentUser?.userId;
    const targetUserType = userType || currentUser?.userType;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required or valid token must be provided'
      });
    }

    // Check permissions from memory store
    const permissions = permissionsStore.get(`${targetUserType}_${targetUserId}`);

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        userType: targetUserType,
        hasPaymentGatewayPermissions: !!permissions,
        permissions: permissions || {
          canCreateGateway: false,
          canManageGateway: false,
          canAssignGateway: false,
          canProcessRequests: false
        },
        note: 'Using workaround - permissions stored in memory'
      }
    });

  } catch (error: any) {
    console.error('Error checking payment gateway permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
