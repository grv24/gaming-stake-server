import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { CommissionService } from '../services/CommissionService';
import { CommissionSettlementService } from '../services/CommissionSettlementService';
import { CommissionTransaction, CommissionType, CommissionStatus, SportType } from '../entities/CommissionTransaction';

export class CommissionController {
  private commissionService: CommissionService;
  private settlementService: CommissionSettlementService;

  constructor(dataSource: DataSource) {
    this.commissionService = new CommissionService(dataSource);
    this.settlementService = new CommissionSettlementService(dataSource);
  }

  /**
   * Calculate commission for a bet
   */
  calculateCommission = async (req: Request, res: Response) => {
    try {
      const { betId, userId, betAmount, sportType, commissionType } = req.body;

      // Validation
      if (!betId || !userId || !betAmount || !sportType) {
        return res.status(400).json({
          success: false,
          error: 'betId, userId, betAmount, and sportType are required'
        });
      }

      if (betAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'betAmount must be greater than 0'
        });
      }

      const calculation = await this.commissionService.calculateCommission(
        betId,
        userId,
        betAmount,
        sportType as SportType,
        commissionType as CommissionType || CommissionType.PANEL
      );

      return res.status(200).json({
        success: true,
        data: calculation
      });
    } catch (error: any) {
      console.error('Error calculating commission:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to calculate commission',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Create commission transactions for a bet
   */
  createCommissionTransactions = async (req: Request, res: Response) => {
    try {
      const { betId, userId, betAmount, sportType, commissionType } = req.body;

      // Validation
      if (!betId || !userId || !betAmount || !sportType) {
        return res.status(400).json({
          success: false,
          error: 'betId, userId, betAmount, and sportType are required'
        });
      }

      const transactions = await this.commissionService.createCommissionTransactions(
        betId,
        userId,
        betAmount,
        sportType as SportType,
        commissionType as CommissionType || CommissionType.PANEL
      );

      return res.status(201).json({
        success: true,
        message: 'Commission transactions created successfully',
        data: transactions
      });
    } catch (error: any) {
      console.error('Error creating commission transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create commission transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get commission report for a user
   */
  getCommissionReport = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { startDate, endDate } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const end = endDate ? new Date(endDate as string) : new Date();

      const report = await this.commissionService.getCommissionReport(userId, start, end);

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Error getting commission report:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get commission report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get pending commission transactions
   */
  getPendingTransactions = async (req: Request, res: Response) => {
    try {
      const transactions = await this.commissionService.getPendingCommissionTransactions();

      return res.status(200).json({
        success: true,
        data: transactions
      });
    } catch (error: any) {
      console.error('Error getting pending transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get pending transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Settle commission transactions
   */
  settleTransactions = async (req: Request, res: Response) => {
    try {
      const { transactionIds } = req.body;
      const settledBy = req.user?.userId || 'system';

      if (!transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({
          success: false,
          error: 'transactionIds array is required'
        });
      }

      const settledTransactions = await this.commissionService.settleCommissionTransactions(
        transactionIds,
        settledBy
      );

      return res.status(200).json({
        success: true,
        message: 'Transactions settled successfully',
        data: settledTransactions
      });
    } catch (error: any) {
      console.error('Error settling transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to settle transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Process daily settlement
   */
  processDailySettlement = async (req: Request, res: Response) => {
    try {
      const settledBy = req.user?.userId || 'system';
      
      const result = await this.settlementService.processDailySettlement(settledBy);

      return res.status(200).json({
        success: result.success,
        message: result.success ? 'Daily settlement completed successfully' : 'Daily settlement completed with errors',
        data: result
      });
    } catch (error: any) {
      console.error('Error processing daily settlement:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process daily settlement',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Process settlement for date range
   */
  processSettlementForDateRange = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.body;
      const settledBy = req.user?.userId || 'system';

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
      }

      const result = await this.settlementService.processSettlementForDateRange(
        new Date(startDate),
        new Date(endDate),
        settledBy
      );

      return res.status(200).json({
        success: result.success,
        message: result.success ? 'Settlement completed successfully' : 'Settlement completed with errors',
        data: result
      });
    } catch (error: any) {
      console.error('Error processing settlement for date range:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process settlement for date range',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Generate daily settlement report
   */
  generateDailySettlementReport = async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      const reportDate = date ? new Date(date as string) : new Date();

      const report = await this.settlementService.generateDailySettlementReport(reportDate);

      return res.status(200).json({
        success: true,
        data: report
      });
    } catch (error: any) {
      console.error('Error generating daily settlement report:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to generate daily settlement report',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get settlement status for a user
   */
  getSettlementStatus = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const status = await this.settlementService.getSettlementStatus(userId);

      return res.status(200).json({
        success: true,
        data: status
      });
    } catch (error: any) {
      console.error('Error getting settlement status:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get settlement status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Cancel commission transactions
   */
  cancelTransactions = async (req: Request, res: Response) => {
    try {
      const { transactionIds, reason } = req.body;
      const cancelledBy = req.user?.userId || 'system';

      if (!transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({
          success: false,
          error: 'transactionIds array is required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'reason is required'
        });
      }

      const cancelledTransactions = await this.settlementService.cancelCommissionTransactions(
        transactionIds,
        reason,
        cancelledBy
      );

      return res.status(200).json({
        success: true,
        message: 'Transactions cancelled successfully',
        data: cancelledTransactions
      });
    } catch (error: any) {
      console.error('Error cancelling transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Refund commission transactions
   */
  refundTransactions = async (req: Request, res: Response) => {
    try {
      const { transactionIds, reason } = req.body;
      const refundedBy = req.user?.userId || 'system';

      if (!transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({
          success: false,
          error: 'transactionIds array is required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'reason is required'
        });
      }

      const refundedTransactions = await this.settlementService.refundCommissionTransactions(
        transactionIds,
        reason,
        refundedBy
      );

      return res.status(200).json({
        success: true,
        message: 'Transactions refunded successfully',
        data: refundedTransactions
      });
    } catch (error: any) {
      console.error('Error refunding transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to refund transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Validate commission configuration
   */
  validateCommissionConfiguration = async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const errors = await this.commissionService.validateCommissionConfiguration(userId);

      return res.status(200).json({
        success: true,
        data: {
          isValid: errors.length === 0,
          errors
        }
      });
    } catch (error: any) {
      console.error('Error validating commission configuration:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to validate commission configuration',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get commission analytics
   */
  getCommissionAnalytics = async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get analytics data
      const analytics = await this.getAnalyticsData(start, end);

      return res.status(200).json({
        success: true,
        data: analytics
      });
    } catch (error: any) {
      console.error('Error getting commission analytics:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get commission analytics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * Get analytics data
   */
  private async getAnalyticsData(startDate: Date, endDate: Date): Promise<any> {
    try {
      const commissionRepo = this.commissionService['dataSource'].getRepository(CommissionTransaction);

      // Get total commission amount
      const totalCommission = await commissionRepo
        .createQueryBuilder('transaction')
        .select('SUM(transaction.commissionAmount)', 'total')
        .where('transaction.status = :status', { status: CommissionStatus.SETTLED })
        .andWhere('transaction.createdAt >= :startDate', { startDate })
        .andWhere('transaction.createdAt <= :endDate', { endDate })
        .getRawOne();

      // Get commission by user type
      const commissionByUserType = await commissionRepo
        .createQueryBuilder('transaction')
        .select('transaction.uplineUserType', 'userType')
        .addSelect('SUM(transaction.commissionAmount)', 'total')
        .where('transaction.status = :status', { status: CommissionStatus.SETTLED })
        .andWhere('transaction.createdAt >= :startDate', { startDate })
        .andWhere('transaction.createdAt <= :endDate', { endDate })
        .groupBy('transaction.uplineUserType')
        .getRawMany();

      // Get commission by sport
      const commissionBySport = await commissionRepo
        .createQueryBuilder('transaction')
        .select('transaction.sportType', 'sportType')
        .addSelect('SUM(transaction.commissionAmount)', 'total')
        .where('transaction.status = :status', { status: CommissionStatus.SETTLED })
        .andWhere('transaction.createdAt >= :startDate', { startDate })
        .andWhere('transaction.createdAt <= :endDate', { endDate })
        .groupBy('transaction.sportType')
        .getRawMany();

      // Get commission by commission type
      const commissionByType = await commissionRepo
        .createQueryBuilder('transaction')
        .select('transaction.commissionType', 'commissionType')
        .addSelect('SUM(transaction.commissionAmount)', 'total')
        .where('transaction.status = :status', { status: CommissionStatus.SETTLED })
        .andWhere('transaction.createdAt >= :startDate', { startDate })
        .andWhere('transaction.createdAt <= :endDate', { endDate })
        .groupBy('transaction.commissionType')
        .getRawMany();

      return {
        totalCommission: parseFloat(totalCommission.total) || 0,
        commissionByUserType: commissionByUserType.reduce((acc, item) => {
          acc[item.userType] = parseFloat(item.total);
          return acc;
        }, {}),
        commissionBySport: commissionBySport.reduce((acc, item) => {
          acc[item.sportType] = parseFloat(item.total);
          return acc;
        }, {}),
        commissionByType: commissionByType.reduce((acc, item) => {
          acc[item.commissionType] = parseFloat(item.total);
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Error getting analytics data:', error);
      throw error;
    }
  }
}

