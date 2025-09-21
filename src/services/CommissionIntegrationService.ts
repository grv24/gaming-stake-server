import { DataSource } from 'typeorm';
import { CommissionService } from './CommissionService';
import { CommissionTransaction, CommissionType, SportType } from '../entities/CommissionTransaction';

export interface BetCommissionData {
  betId: string;
  userId: string;
  userType: string;
  betAmount: number;
  sportType: SportType;
  commissionType?: CommissionType;
}

export class CommissionIntegrationService {
  private dataSource: DataSource;
  private commissionService: CommissionService;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.commissionService = new CommissionService(dataSource);
  }

  /**
   * Process commission when a bet is placed
   */
  async processBetCommission(betData: BetCommissionData): Promise<CommissionTransaction[]> {
    try {
      console.log(`[COMMISSION-INTEGRATION] Processing commission for bet ${betData.betId}`);

      // Validate bet data
      this.validateBetData(betData);

      // Create commission transactions
      const transactions = await this.commissionService.createCommissionTransactions(
        betData.betId,
        betData.userId,
        betData.betAmount,
        betData.sportType,
        betData.commissionType || CommissionType.PANEL
      );

      console.log(`[COMMISSION-INTEGRATION] Created ${transactions.length} commission transactions for bet ${betData.betId}`);

      return transactions;
    } catch (error) {
      console.error(`[COMMISSION-INTEGRATION] Error processing commission for bet ${betData.betId}:`, error);
      throw error;
    }
  }

  /**
   * Process commission when a bet is settled
   */
  async processBetSettlement(
    betId: string,
    settlementData: {
      isWinner: boolean;
      profitLoss: number;
      settlementAmount: number;
    }
  ): Promise<void> {
    try {
      console.log(`[COMMISSION-INTEGRATION] Processing settlement for bet ${betId}`);

      // Get commission transactions for this bet
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .find({
          where: { betId },
          order: { createdAt: 'ASC' }
        });

      if (transactions.length === 0) {
        console.log(`[COMMISSION-INTEGRATION] No commission transactions found for bet ${betId}`);
        return;
      }

      // Update transaction metadata with settlement information
      for (const transaction of transactions) {
        transaction.metadata = {
          ...transaction.metadata,
          settlementData: {
            isWinner: settlementData.isWinner,
            profitLoss: settlementData.profitLoss,
            settlementAmount: settlementData.settlementAmount,
            settledAt: new Date()
          }
        };
      }

      // Save updated transactions
      await this.dataSource
        .getRepository(CommissionTransaction)
        .save(transactions);

      console.log(`[COMMISSION-INTEGRATION] Updated ${transactions.length} commission transactions for bet ${betId}`);
    } catch (error) {
      console.error(`[COMMISSION-INTEGRATION] Error processing settlement for bet ${betId}:`, error);
      throw error;
    }
  }

  /**
   * Process commission when a bet is cancelled
   */
  async processBetCancellation(
    betId: string,
    cancellationReason: string
  ): Promise<void> {
    try {
      console.log(`[COMMISSION-INTEGRATION] Processing cancellation for bet ${betId}`);

      // Get commission transactions for this bet
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .find({
          where: { betId }
        });

      if (transactions.length === 0) {
        console.log(`[COMMISSION-INTEGRATION] No commission transactions found for bet ${betId}`);
        return;
      }

      // Cancel all pending transactions
      const transactionIds = transactions
        .filter(t => t.status === 'pending')
        .map(t => t.id);

      if (transactionIds.length > 0) {
        const settlementService = new (await import('./CommissionSettlementService')).CommissionSettlementService(this.dataSource);
        await settlementService.cancelCommissionTransactions(
          transactionIds,
          `Bet cancelled: ${cancellationReason}`,
          'system'
        );
      }

      console.log(`[COMMISSION-INTEGRATION] Cancelled ${transactionIds.length} commission transactions for bet ${betId}`);
    } catch (error) {
      console.error(`[COMMISSION-INTEGRATION] Error processing cancellation for bet ${betId}:`, error);
      throw error;
    }
  }

  /**
   * Get commission summary for a bet
   */
  async getBetCommissionSummary(betId: string): Promise<{
    totalCommission: number;
    commissionBreakdown: Array<{
      userId: string;
      userType: string;
      commissionAmount: number;
      status: string;
    }>;
  }> {
    try {
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .find({
          where: { betId },
          order: { createdAt: 'ASC' }
        });

      const totalCommission = transactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );

      const commissionBreakdown = transactions.map(t => ({
        userId: t.uplineUserId,
        userType: t.uplineUserType,
        commissionAmount: t.commissionAmount,
        status: t.status
      }));

      return {
        totalCommission,
        commissionBreakdown
      };
    } catch (error) {
      console.error(`[COMMISSION-INTEGRATION] Error getting commission summary for bet ${betId}:`, error);
      throw error;
    }
  }

  /**
   * Get user commission summary
   */
  async getUserCommissionSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalCommission: number;
    pendingCommission: number;
    settledCommission: number;
    totalBets: number;
    commissionBySport: Record<string, number>;
  }> {
    try {
      const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate || new Date();

      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .createQueryBuilder('transaction')
        .where('transaction.uplineUserId = :userId', { userId })
        .andWhere('transaction.createdAt >= :startDate', { startDate: start })
        .andWhere('transaction.createdAt <= :endDate', { endDate: end })
        .getMany();

      const totalCommission = transactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );

      const pendingCommission = transactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const settledCommission = transactions
        .filter(t => t.status === 'settled')
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const totalBets = new Set(transactions.map(t => t.betId)).size;

      const commissionBySport = transactions.reduce((acc, t) => {
        if (t.sportType) {
          acc[t.sportType] = (acc[t.sportType] || 0) + t.commissionAmount;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        totalCommission,
        pendingCommission,
        settledCommission,
        totalBets,
        commissionBySport
      };
    } catch (error) {
      console.error(`[COMMISSION-INTEGRATION] Error getting commission summary for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Validate bet data
   */
  private validateBetData(betData: BetCommissionData): void {
    if (!betData.betId) {
      throw new Error('betId is required');
    }
    if (!betData.userId) {
      throw new Error('userId is required');
    }
    if (!betData.betAmount || betData.betAmount <= 0) {
      throw new Error('betAmount must be greater than 0');
    }
    if (!betData.sportType) {
      throw new Error('sportType is required');
    }
  }

  /**
   * Get commission statistics
   */
  async getCommissionStatistics(): Promise<{
    totalCommissionAmount: number;
    pendingCommissionAmount: number;
    settledCommissionAmount: number;
    totalTransactions: number;
    pendingTransactions: number;
    settledTransactions: number;
    commissionByUserType: Record<string, number>;
    commissionBySport: Record<string, number>;
  }> {
    try {
      const transactions = await this.dataSource
        .getRepository(CommissionTransaction)
        .find();

      const totalCommissionAmount = transactions.reduce(
        (sum, t) => sum + t.commissionAmount,
        0
      );

      const pendingCommissionAmount = transactions
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const settledCommissionAmount = transactions
        .filter(t => t.status === 'settled')
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const totalTransactions = transactions.length;
      const pendingTransactions = transactions.filter(t => t.status === 'pending').length;
      const settledTransactions = transactions.filter(t => t.status === 'settled').length;

      const commissionByUserType = transactions.reduce((acc, t) => {
        acc[t.uplineUserType] = (acc[t.uplineUserType] || 0) + t.commissionAmount;
        return acc;
      }, {} as Record<string, number>);

      const commissionBySport = transactions.reduce((acc, t) => {
        if (t.sportType) {
          acc[t.sportType] = (acc[t.sportType] || 0) + t.commissionAmount;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        totalCommissionAmount,
        pendingCommissionAmount,
        settledCommissionAmount,
        totalTransactions,
        pendingTransactions,
        settledTransactions,
        commissionByUserType,
        commissionBySport
      };
    } catch (error) {
      console.error('[COMMISSION-INTEGRATION] Error getting commission statistics:', error);
      throw error;
    }
  }
}
