import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { BalanceManagementService, BalanceTransferRequest, CreditReferenceUpdate, BalanceAdjustment } from '../services/BalanceManagementService';

export class BalanceManagementController {
  private balanceService: BalanceManagementService;

  constructor(dataSource: DataSource) {
    this.balanceService = new BalanceManagementService(dataSource);
  }

  /**
   * Get balance dashboard for a user
   */
  getBalanceDashboard = async (req: Request, res: Response) => {
    try {
      const { userId, userType } = req.params;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          message: 'User ID and User Type are required'
        });
      }

      const dashboard = await this.balanceService.getBalanceDashboard(userId, userType);

      return res.status(200).json({
        success: true,
        data: dashboard,
        message: 'Balance dashboard retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting balance dashboard:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get balance dashboard',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get balance summary for a user
   */
  getBalanceSummary = async (req: Request, res: Response) => {
    try {
      const { userId, userType } = req.params;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          message: 'User ID and User Type are required'
        });
      }

      const dashboard = await this.balanceService.getBalanceDashboard(userId, userType);
      
      const summary = {
        userId,
        userType,
        currentBalance: dashboard.totalMasterBalance,
        availableBalance: dashboard.availableBalance,
        profitLoss: dashboard.myProfitLoss,
        creditReference: dashboard.upperLevelCreditReference,
        downlineBalance: dashboard.downLevelOccupyBalance,
        downlineProfitLoss: dashboard.downLevelProfitLoss,
        lastUpdated: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        data: summary,
        message: 'Balance summary retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting balance summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get balance summary',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Transfer balance between users
   */
  transferBalance = async (req: Request, res: Response) => {
    try {
      const transferRequest: BalanceTransferRequest = req.body;

      if (!transferRequest.fromUserId || !transferRequest.toUserId || !transferRequest.amount || !transferRequest.transferType) {
        return res.status(400).json({
          success: false,
          message: 'fromUserId, toUserId, amount, and transferType are required'
        });
      }

      if (transferRequest.amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Transfer amount must be positive'
        });
      }

      const result = await this.balanceService.transferBalance(transferRequest);

      return res.status(200).json({
        success: result.success,
        message: result.message,
        data: {
          fromUserId: transferRequest.fromUserId,
          toUserId: transferRequest.toUserId,
          amount: transferRequest.amount,
          transferType: transferRequest.transferType
        }
      });
    } catch (error: any) {
      console.error('Error transferring balance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to transfer balance',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Update credit reference for a user
   */
  updateCreditReference = async (req: Request, res: Response) => {
    try {
      const updateRequest: CreditReferenceUpdate = req.body;

      if (!updateRequest.userId || updateRequest.newCreditRef === undefined) {
        return res.status(400).json({
          success: false,
          message: 'userId and newCreditRef are required'
        });
      }

      if (updateRequest.newCreditRef < 0) {
        return res.status(400).json({
          success: false,
          message: 'Credit reference must be non-negative'
        });
      }

      const result = await this.balanceService.updateCreditReference(updateRequest);

      return res.status(200).json({
        success: result.success,
        message: result.message,
        data: {
          userId: updateRequest.userId,
          newCreditRef: updateRequest.newCreditRef
        }
      });
    } catch (error: any) {
      console.error('Error updating credit reference:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update credit reference',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Adjust user balance
   */
  adjustBalance = async (req: Request, res: Response) => {
    try {
      const adjustment: BalanceAdjustment = req.body;

      if (!adjustment.userId || !adjustment.adjustmentType || adjustment.amount === undefined || !adjustment.operation) {
        return res.status(400).json({
          success: false,
          message: 'userId, adjustmentType, amount, and operation are required'
        });
      }

      if (adjustment.amount < 0) {
        return res.status(400).json({
          success: false,
          message: 'Adjustment amount must be non-negative'
        });
      }

      const result = await this.balanceService.adjustBalance(adjustment);

      return res.status(200).json({
        success: result.success,
        message: result.message,
        data: {
          userId: adjustment.userId,
          adjustmentType: adjustment.adjustmentType,
          amount: adjustment.amount,
          operation: adjustment.operation
        }
      });
    } catch (error: any) {
      console.error('Error adjusting balance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to adjust balance',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Bulk balance adjustment for multiple users
   */
  bulkAdjustBalance = async (req: Request, res: Response) => {
    try {
      const { adjustments } = req.body;

      if (!adjustments || !Array.isArray(adjustments)) {
        return res.status(400).json({
          success: false,
          message: 'adjustments array is required'
        });
      }

      const results = {
        successful: [] as Array<{userId: string; success: boolean; message: string}>,
        failed: [] as Array<{userId: string; success: boolean; message: string}>
      };

      for (const adjustment of adjustments) {
        try {
          const result = await this.balanceService.adjustBalance(adjustment);
          results.successful.push({
            userId: adjustment.userId,
            success: result.success,
            message: result.message
          });
        } catch (error: any) {
          results.failed.push({
            userId: adjustment.userId,
            success: false,
            message: error.message
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: results,
        message: `Bulk adjustment completed: ${results.successful.length} successful, ${results.failed.length} failed`
      });
    } catch (error: any) {
      console.error('Error in bulk balance adjustment:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to perform bulk balance adjustment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get balance history for a user
   */
  getBalanceHistory = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'userId is required'
        });
      }

      const limitNumber = limit ? parseInt(limit as string) : 50;
      const history = await this.balanceService.getBalanceHistory(userId, limitNumber);

      return res.status(200).json({
        success: true,
        data: history,
        message: 'Balance history retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting balance history:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get balance history',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get occupy balance information for a user
   */
  getOccupyBalance = async (req: Request, res: Response) => {
    try {
      const { userId, userType } = req.params;

      if (!userId || !userType) {
        return res.status(400).json({
          success: false,
          message: 'User ID and User Type are required'
        });
      }

      const dashboard = await this.balanceService.getBalanceDashboard(userId, userType);
      
      const occupyData = {
        userId,
        userType,
        upperLevelOccupyBalance: dashboard.upperLevelOccupyBalance,
        downLevelOccupyBalance: dashboard.downLevelOccupyBalance,
        totalMasterBalance: dashboard.totalMasterBalance,
        availableBalance: dashboard.availableBalance,
        upperLevelCreditReference: dashboard.upperLevelCreditReference,
        downLevelCreditReference: dashboard.downLevelCreditReference,
        lastUpdated: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        data: occupyData,
        message: 'Occupy balance information retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting occupy balance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get occupy balance information',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
}
