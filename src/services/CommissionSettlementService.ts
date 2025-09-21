import { DataSource } from 'typeorm';
import { CommissionService } from './CommissionService';
import { CommissionTransaction, CommissionStatus } from '../entities/CommissionTransaction';

export interface SettlementResult {
  success: boolean;
  totalTransactions: number;
  settledTransactions: number;
  totalCommissionAmount: number;
  errors: string[];
  settlementDate: Date;
}

export interface DailySettlementReport {
  settlementDate: Date;
  totalBets: number;
  totalCommissionAmount: number;
  commissionByUserType: Record<string, number>;
  commissionBySport: Record<string, number>;
  settlementSummary: {
    totalTransactions: number;
    settledTransactions: number;
    failedTransactions: number;
    pendingTransactions: number;
  };
}

export class CommissionSettlementService {
  private dataSource: DataSource;
  private commissionService: CommissionService;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.commissionService = new CommissionService(dataSource);
  }

  /**
   * Process daily commission settlement
   */
  async processDailySettlement(settledBy: string = 'system'): Promise<SettlementResult> {
    const result: SettlementResult = {
      success: false,
      totalTransactions: 0,
      settledTransactions: 0,
      totalCommissionAmount: 0,
      errors: [],
      settlementDate: new Date()
    };

    try {
      console.log(`[COMMISSION-SETTLEMENT] Starting daily settlement at ${new Date().toISOString()}`);

      // Get all pending commission transactions
      const pendingTransactions = await this.commissionService.getPendingCommissionTransactions();
      result.totalTransactions = pendingTransactions.length;

      if (pendingTransactions.length === 0) {
        console.log('[COMMISSION-SETTLEMENT] No pending transactions to settle');
        result.success = true;
        return result;
      }

      // Group transactions by user for batch processing
      const transactionsByUser = this.groupTransactionsByUser(pendingTransactions);

      // Process settlement for each user
      for (const [userId, transactions] of transactionsByUser) {
        try {
          const transactionIds = transactions.map(t => t.id);
          const settledTransactions = await this.commissionService.settleCommissionTransactions(
            transactionIds,
            settledBy
          );

          result.settledTransactions += settledTransactions.length;
          result.totalCommissionAmount += settledTransactions.reduce(
            (sum, t) => sum + t.commissionAmount,
            0
          );

          console.log(`[COMMISSION-SETTLEMENT] Settled ${settledTransactions.length} transactions for user ${userId}`);
        } catch (error: any) {
          const errorMessage = `Failed to settle transactions for user ${userId}: ${error.message}`;
          result.errors.push(errorMessage);
          console.error(`[COMMISSION-SETTLEMENT] ${errorMessage}`);
        }
      }

      result.success = result.errors.length === 0;

      console.log(`[COMMISSION-SETTLEMENT] Settlement completed:`, {
        totalTransactions: result.totalTransactions,
        settledTransactions: result.settledTransactions,
        totalCommissionAmount: result.totalCommissionAmount,
        errors: result.errors.length
      });

      return result;
    } catch (error: any) {
      const errorMessage = `Daily settlement failed: ${error.message}`;
      result.errors.push(errorMessage);
      console.error(`[COMMISSION-SETTLEMENT] ${errorMessage}`);
      return result;
    }
  }

  /**
   * Process settlement for specific date range
   */
  async processSettlementForDateRange(
    startDate: Date,
    endDate: Date,
    settledBy: string = 'system'
  ): Promise<SettlementResult> {
    const result: SettlementResult = {
      success: false,
      totalTransactions: 0,
      settledTransactions: 0,
      totalCommissionAmount: 0,
      errors: [],
      settlementDate: new Date()
    };

    try {
      console.log(`[COMMISSION-SETTLEMENT] Processing settlement for date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get pending transactions within date range
      const pendingTransactions = await this.getPendingTransactionsInDateRange(startDate, endDate);
      result.totalTransactions = pendingTransactions.length;

      if (pendingTransactions.length === 0) {
        console.log('[COMMISSION-SETTLEMENT] No pending transactions in date range');
        result.success = true;
        return result;
      }

      // Process settlement
      const transactionIds = pendingTransactions.map(t => t.id);
      const settledTransactions = await this.commissionService.settleCommissionTransactions(
        transactionIds,
        settledBy
      );

      result.settledTransactions = settledTransactions.length;
      result.totalCommissionAmount = settledTransactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );
      result.success = true;

      console.log(`[COMMISSION-SETTLEMENT] Settlement completed for date range:`, {
        totalTransactions: result.totalTransactions,
        settledTransactions: result.settledTransactions,
        totalCommissionAmount: result.totalCommissionAmount
      });

      return result;
    } catch (error: any) {
      const errorMessage = `Settlement for date range failed: ${error.message}`;
      result.errors.push(errorMessage);
      console.error(`[COMMISSION-SETTLEMENT] ${errorMessage}`);
      return result;
    }
  }

  /**
   * Generate daily settlement report
   */
  async generateDailySettlementReport(date: Date): Promise<DailySettlementReport> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all transactions for the day
      const transactions = await this.getTransactionsInDateRange(startOfDay, endOfDay);

      // Calculate statistics
      const totalBets = new Set(transactions.map(t => t.betId)).size;
      const totalCommissionAmount = transactions
        .filter(t => t.status === CommissionStatus.SETTLED)
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const commissionByUserType = transactions
        .filter(t => t.status === CommissionStatus.SETTLED)
        .reduce((acc, t) => {
          acc[t.uplineUserType] = (acc[t.uplineUserType] || 0) + t.commissionAmount;
          return acc;
        }, {} as Record<string, number>);

      const commissionBySport = transactions
        .filter(t => t.status === CommissionStatus.SETTLED && t.sportType)
        .reduce((acc, t) => {
          acc[t.sportType!] = (acc[t.sportType!] || 0) + t.commissionAmount;
          return acc;
        }, {} as Record<string, number>);

      const settlementSummary = {
        totalTransactions: transactions.length,
        settledTransactions: transactions.filter(t => t.status === CommissionStatus.SETTLED).length,
        failedTransactions: transactions.filter(t => t.status === CommissionStatus.CANCELLED).length,
        pendingTransactions: transactions.filter(t => t.status === CommissionStatus.PENDING).length
      };

      return {
        settlementDate: date,
        totalBets,
        totalCommissionAmount,
        commissionByUserType,
        commissionBySport,
        settlementSummary
      };
    } catch (error) {
      console.error('Error generating daily settlement report:', error);
      throw error;
    }
  }

  /**
   * Get settlement status for a user
   */
  async getSettlementStatus(userId: string): Promise<{
    pendingAmount: number;
    settledAmount: number;
    totalTransactions: number;
    pendingTransactions: number;
    settledTransactions: number;
  }> {
    try {
      const pendingTransactions = await this.commissionService.getPendingCommissionTransactions();
      const userPendingTransactions = pendingTransactions.filter(t => t.uplineUserId === userId);

      const settledTransactions = await this.getSettledTransactionsForUser(userId);

      const pendingAmount = userPendingTransactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );

      const settledAmount = settledTransactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );

      return {
        pendingAmount,
        settledAmount,
        totalTransactions: userPendingTransactions.length + settledTransactions.length,
        pendingTransactions: userPendingTransactions.length,
        settledTransactions: settledTransactions.length
      };
    } catch (error) {
      console.error('Error getting settlement status:', error);
      throw error;
    }
  }

  /**
   * Cancel commission transactions
   */
  async cancelCommissionTransactions(
    transactionIds: string[],
    reason: string,
    cancelledBy: string
  ): Promise<CommissionTransaction[]> {
    try {
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .findByIds(transactionIds);

      if (transactions.length === 0) {
        throw new Error('No transactions found');
      }

      const cancelledTransactions: CommissionTransaction[] = [];

      for (const transaction of transactions) {
        if (transaction.status === CommissionStatus.PENDING) {
          transaction.status = CommissionStatus.CANCELLED;
          transaction.remarks = `Cancelled: ${reason}`;
          transaction.settledBy = cancelledBy;
          transaction.settledAt = new Date();

          cancelledTransactions.push(transaction);
        }
      }

      return await this.dataSource
        .getRepository(CommissionTransaction)
        .save(cancelledTransactions);
    } catch (error) {
      console.error('Error cancelling commission transactions:', error);
      throw error;
    }
  }

  /**
   * Refund commission transactions
   */
  async refundCommissionTransactions(
    transactionIds: string[],
    reason: string,
    refundedBy: string
  ): Promise<CommissionTransaction[]> {
    try {
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .findByIds(transactionIds);

      if (transactions.length === 0) {
        throw new Error('No transactions found');
      }

      const refundedTransactions: CommissionTransaction[] = [];

      for (const transaction of transactions) {
        if (transaction.status === CommissionStatus.SETTLED) {
          // Reverse the commission amount
          await this.reverseUserBalance(
            transaction.uplineUserId,
            transaction.commissionAmount
          );

          transaction.status = CommissionStatus.REFUNDED;
          transaction.remarks = `Refunded: ${reason}`;
          transaction.settledBy = refundedBy;
          transaction.settledAt = new Date();

          refundedTransactions.push(transaction);
        }
      }

      return await this.dataSource
        .getRepository(CommissionTransaction)
        .save(refundedTransactions);
    } catch (error) {
      console.error('Error refunding commission transactions:', error);
      throw error;
    }
  }

  /**
   * Group transactions by user
   */
  private groupTransactionsByUser(transactions: CommissionTransaction[]): Map<string, CommissionTransaction[]> {
    const grouped = new Map<string, CommissionTransaction[]>();

    for (const transaction of transactions) {
      const userId = transaction.uplineUserId;
      if (!grouped.has(userId)) {
        grouped.set(userId, []);
      }
      grouped.get(userId)!.push(transaction);
    }

    return grouped;
  }

  /**
   * Get pending transactions in date range
   */
  private async getPendingTransactionsInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<CommissionTransaction[]> {
    return await this.dataSource
      .getRepository(CommissionTransaction)
      .createQueryBuilder('transaction')
      .where('transaction.status = :status', { status: CommissionStatus.PENDING })
      .andWhere('transaction.createdAt >= :startDate', { startDate })
      .andWhere('transaction.createdAt <= :endDate', { endDate })
      .orderBy('transaction.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Get all transactions in date range
   */
  private async getTransactionsInDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<CommissionTransaction[]> {
    return await this.dataSource
      .getRepository(CommissionTransaction)
      .createQueryBuilder('transaction')
      .where('transaction.createdAt >= :startDate', { startDate })
      .andWhere('transaction.createdAt <= :endDate', { endDate })
      .orderBy('transaction.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Get settled transactions for a user
   */
  private async getSettledTransactionsForUser(userId: string): Promise<CommissionTransaction[]> {
    return await this.dataSource
      .getRepository(CommissionTransaction)
      .find({
        where: {
          uplineUserId: userId,
          status: CommissionStatus.SETTLED
        },
        order: {
          settledAt: 'DESC'
        }
      });
  }

  /**
   * Reverse user balance (for refunds)
   */
  private async reverseUserBalance(userId: string, amount: number): Promise<void> {
    try {
      const user = await this.commissionService['findUserById'](userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Reverse balance and profit/loss
      user.balance = Number(user.balance) - amount;
      user.profitLoss = Number(user.profitLoss) - amount;

      // Save user
      const userRepo = this.dataSource.getRepository(user.constructor as any);
      await userRepo.save(user);
    } catch (error) {
      console.error(`Error reversing balance for user ${userId}:`, error);
      throw error;
    }
  }
}
