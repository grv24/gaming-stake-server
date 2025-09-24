import { DataSource, Repository, Like } from 'typeorm';
import { TechAdmin } from '../entities/users/TechAdminUser';
import { Admin } from '../entities/users/AdminUser';
import { MiniAdmin } from '../entities/users/MiniAdminUser';
import { SuperMaster } from '../entities/users/SuperMasterUser';
import { Master } from '../entities/users/MasterUser';
import { SuperAgent } from '../entities/users/SuperAgentUser';
import { Agent } from '../entities/users/AgentUser';
import { Client } from '../entities/users/ClientUser';
import { USER_TABLES } from '../Helpers/users/Roles';
import { AccountTrasaction } from '../entities/Transactions/AccountTransactions';
import { SoccerSettings } from '../entities/users/utils/SoccerSetting';
import { CricketSettings } from '../entities/users/utils/CricketSetting';
import { TennisSettings } from '../entities/users/utils/TennisSetting';
import { MatkaSettings } from '../entities/users/utils/MatkaSetting';
import { CasinoSettings } from '../entities/users/utils/CasinoSetting';
import { InternationalCasinoSettings } from '../entities/users/utils/InternationalCasino';
import { commissionCalculationService } from './CommissionCalculationService';

export interface BalanceDashboard {
  upperLevelCreditReference: number;
  totalMasterBalance: number;
  availableBalance: number;
  downLevelOccupyBalance: number;
  upperLevelOccupyBalance: number;
  upperLevel: number;
  availableBalanceWithProfitLoss: number;
  downLevelCreditReference: number;
  downLevelProfitLoss: number;
  myProfitLoss: number;
  // Enhanced commission fields
  commissionEarned: number;
  directDownlineProfitLoss: number;
  totalDownlineCount: number;
  directDownlineCount: number;
  netPosition: number;
}

export interface BalanceTransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  transferType: 'credit' | 'debit' | 'settlement';
  remarks?: string;
}

export interface CreditReferenceUpdate {
  userId: string;
  newCreditRef: number;
  remarks?: string;
}

export interface BalanceAdjustment {
  userId: string;
  adjustmentType: 'balance' | 'profitLoss' | 'liability' | 'exposure';
  amount: number;
  operation: 'add' | 'subtract' | 'set';
  remarks?: string;
}

export class BalanceManagementService {
  private dataSource: DataSource;
  private userRepos: Map<string, Repository<any>>;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.userRepos = new Map();
    
    // Initialize repositories
    this.userRepos.set('techAdmin', dataSource.getRepository(TechAdmin));
    this.userRepos.set('admin', dataSource.getRepository(Admin));
    this.userRepos.set('miniAdmin', dataSource.getRepository(MiniAdmin));
    this.userRepos.set('superMaster', dataSource.getRepository(SuperMaster));
    this.userRepos.set('master', dataSource.getRepository(Master));
    this.userRepos.set('superAgent', dataSource.getRepository(SuperAgent));
    this.userRepos.set('agent', dataSource.getRepository(Agent));
    this.userRepos.set('client', dataSource.getRepository(Client));
    
    console.log('[BALANCE-MANAGEMENT] Initialized repositories:', Array.from(this.userRepos.keys()));
  }

  /**
   * Calculate accurate profit/loss from account transactions
   */
  private async calculateUserProfitLoss(userId: string): Promise<number> {
    try {
      const accountTransactionRepo = this.dataSource.getRepository(AccountTrasaction);
      
      // Get all settled betting transactions for the user (both casino and sports)
      const settledBets = await accountTransactionRepo
        .createQueryBuilder('transaction')
        .where('transaction.downlineUserId = :userId', { userId })
        .andWhere(
          '(transaction.type = :settleBetType OR ' +
          '(transaction.type = :withdrawType AND transaction.remarks LIKE :sportSettled) OR ' +
          '(transaction.type = :depositType AND transaction.remarks LIKE :sportSettled))',
          {
            settleBetType: 'settle-bet',
            withdrawType: 'withdraw',
            depositType: 'deposit',
            sportSettled: '%SPORT-BET-SETTLED%'
          }
        )
        .getMany();

      let totalProfitLoss = 0;

      for (const transaction of settledBets) {
        if (transaction.type === 'settle-bet') {
          // For settle-bet, extract P/L from remarks
          const remarks = transaction.remarks || '';
          const plMatch = remarks.match(/P\/L:\s*([+-]?\d+(?:\.\d+)?)/);
          if (plMatch) {
            const plAmount = parseFloat(plMatch[1]) || 0;
            totalProfitLoss += plAmount;
          }
        } else if (transaction.type === 'deposit') {
          // For deposit (wins), add the amount as positive
          const amount = parseFloat(String(transaction.amount)) || 0;
          totalProfitLoss += amount;
        } else if (transaction.type === 'withdraw') {
          // For withdraw (losses), subtract the amount as negative
          const amount = parseFloat(String(transaction.amount)) || 0;
          totalProfitLoss -= amount;
        }
      }

      return parseFloat(String(totalProfitLoss)) || 0;
    } catch (error) {
      console.error(`Error calculating profit/loss for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Simple function to get commission earned from commissionFlow data
   */
  private async getCommissionEarned(userId: string, userType: string): Promise<number> {
    try {
      console.log(`[COMMISSION-DEBUG] Getting commission earned for ${userType}(${userId})`);
      
      const { CommissionTransaction } = await import('../entities/CommissionTransaction');
      const commissionRepo = this.dataSource.getRepository(CommissionTransaction);
      
      // Get all commission transactions
      const allTransactions = await commissionRepo.find();
      console.log(`[COMMISSION-DEBUG] Found ${allTransactions.length} total commission transactions`);
      
      let totalCommission = 0;
      
      for (const transaction of allTransactions) {
        if (transaction.metadata && transaction.metadata.commissionFlow) {
          const commissionFlow = transaction.metadata.commissionFlow;
          const userCommissionData = commissionFlow[userType];
          
          if (userCommissionData && userCommissionData.commissionEarned !== undefined) {
            const transactionCommission = parseFloat(String(userCommissionData.commissionEarned)) || 0;
            totalCommission += transactionCommission;
            console.log(`[COMMISSION-DEBUG] Transaction ${transaction.id}: ${userType} earned ${transactionCommission}, Total: ${totalCommission}`);
          }
        }
      }
      
      console.log(`[COMMISSION-DEBUG] Final commission earned for ${userType}(${userId}): ${totalCommission}`);
      return totalCommission;
    } catch (error) {
      console.error(`Error getting commission earned for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Calculate downline profit/loss with commission structure
   */
  private async calculateDownlineProfitLossWithCommissions(userId: string, userType: string): Promise<{
    directDownlineProfitLoss: number;
    totalDownlineProfitLoss: number;
    commissionEarned: number;
    downlineCount: number;
    directDownlineCount: number;
  }> {
    try {
      console.log(`[COMMISSION-DEBUG] *** FUNCTION CALLED *** Starting calculation for user ${userId} (${userType})`);
      const downlineTypes = this.getDownlineTypes(userType);
      let directDownlineProfitLoss = 0;
      let totalDownlineProfitLoss = 0;
      let directDownlineCount = 0;
      let totalDownlineCount = 0;

      // Get commission earned from commissionFlow data
      const commissionEarned = await this.getCommissionEarned(userId, userType);

      // Calculate direct downline profit/loss
      for (const downlineType of downlineTypes) {
        const repo = this.userRepos.get(downlineType);
        if (!repo) continue;

        const directDownlines = await repo.find({
          where: { uplineId: userId }
        });

        directDownlineCount += directDownlines.length;

        for (const downline of directDownlines) {
          const userProfitLoss = await this.calculateUserProfitLoss(downline.id);
          const profitLossAmt = parseFloat(String(userProfitLoss)) || 0;
          
          directDownlineProfitLoss = parseFloat(String(directDownlineProfitLoss)) + profitLossAmt;
          
          // Recursively calculate total downline profit/loss
          const recursiveResult = await this.calculateDownlineProfitLossWithCommissions(downline.id, downlineType);
          const recursiveAmount = parseFloat(String(recursiveResult.totalDownlineProfitLoss)) || 0;
          totalDownlineProfitLoss = parseFloat(String(totalDownlineProfitLoss)) + recursiveAmount;
          totalDownlineCount += parseFloat(String(recursiveResult.downlineCount)) || 0;
        }
      }

      totalDownlineProfitLoss = parseFloat(String(totalDownlineProfitLoss)) + parseFloat(String(directDownlineProfitLoss));
      totalDownlineCount += directDownlineCount;

      console.log(`[COMMISSION-DEBUG] Final result for ${userId} (${userType}): commissionEarned=${commissionEarned}, directDownlineProfitLoss=${directDownlineProfitLoss}, totalDownlineProfitLoss=${totalDownlineProfitLoss}`);

      return {
        directDownlineProfitLoss: parseFloat(String(directDownlineProfitLoss)) || 0,
        totalDownlineProfitLoss: parseFloat(String(totalDownlineProfitLoss)) || 0,
        commissionEarned: parseFloat(String(commissionEarned)) || 0,
        downlineCount: totalDownlineCount || 0,
        directDownlineCount: directDownlineCount || 0
      };
    } catch (error) {
      console.error(`Error calculating downline profit/loss with commissions for user ${userId}:`, error);
      return { directDownlineProfitLoss: 0, totalDownlineProfitLoss: 0, commissionEarned: 0, downlineCount: 0, directDownlineCount: 0 };
    }
  }

  /**
   * Get stored commission rate from user settings
   */
  private async getStoredCommissionRate(downlineUserId: string, downlineType: string, uplineUserId: string): Promise<number> {
    try {
      // Get the downline user to access their settings
      const downlineUser = await this.findUserById(downlineUserId, downlineType);
      if (!downlineUser) {
        return 0;
      }

      // Check different settings tables for commission rates
      const settingsTables = [
        { repo: this.dataSource.getRepository(SoccerSettings), field: 'soccerSettingId' },
        { repo: this.dataSource.getRepository(CricketSettings), field: 'cricketSettingId' },
        { repo: this.dataSource.getRepository(TennisSettings), field: 'tennisSettingId' },
        { repo: this.dataSource.getRepository(MatkaSettings), field: 'matkaSettingId' },
        { repo: this.dataSource.getRepository(CasinoSettings), field: 'casinoSettingId' },
        { repo: this.dataSource.getRepository(InternationalCasinoSettings), field: 'internationalCasinoSettingId' }
      ];

      for (const { repo, field } of settingsTables) {
        const settingId = (downlineUser as any)[field];
        if (settingId) {
          const setting = await repo.findOne({
            where: { id: settingId }
          });
          
          if (setting && setting.commissionUplineUserId === uplineUserId) {
            return Number(setting.commissionUpline) || 0;
          }
        }
      }

      // If no specific commission found, return 0
      return 0;
    } catch (error) {
      console.error(`Error getting stored commission rate for user ${downlineUserId}:`, error);
      return 0;
    }
  }

  /**
   * Get balance dashboard for a user
   */
  async getBalanceDashboard(userId: string, userType: string): Promise<BalanceDashboard> {
    try {
      console.log(`[BALANCE-DEBUG] *** GET BALANCE DASHBOARD CALLED *** for ${userId} (${userType})`);
      const user = await this.findUserById(userId, userType);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Calculate downline balances (for occupy balance and credit reference only)
      const downlineData = await this.calculateDownlineBalances(userId, userType);
      
      // Calculate upline data
      const uplineData = await this.calculateUplineData(userId, userType);

      // Calculate upper level occupy balance
      const upperLevelOccupyBalance = await this.calculateUpperLevelOccupyBalance(userId, userType);

      // Calculate accurate profit/loss for current user from account transactions
      const myAccurateProfitLoss = await this.calculateUserProfitLoss(userId);

      // Calculate enhanced downline profit/loss with commissions
      console.log(`[BALANCE-DEBUG] About to calculate downline profit/loss with commissions for ${userId} (${userType})`);
      let downlineDataWithCommissions;
      try {
        downlineDataWithCommissions = await this.calculateDownlineProfitLossWithCommissions(userId, userType);
        console.log(`[BALANCE-DEBUG] Commission calculation result:`, downlineDataWithCommissions);
      } catch (error) {
        console.error(`[BALANCE-DEBUG] Error in commission calculation:`, error);
        downlineDataWithCommissions = { directDownlineProfitLoss: 0, totalDownlineProfitLoss: 0, commissionEarned: 0, downlineCount: 0, directDownlineCount: 0 };
      }

      // Calculate net position (own profit/loss + commissions earned)
      const netPosition = parseFloat(String(myAccurateProfitLoss)) + parseFloat(String(downlineDataWithCommissions.commissionEarned || 0));

      return {
        upperLevelCreditReference: uplineData.creditRef || 0,
        totalMasterBalance: user.balance || 0,
        availableBalance: this.calculateAvailableBalance(user),
        downLevelOccupyBalance: downlineData.totalOccupyBalance || 0,
        upperLevelOccupyBalance: upperLevelOccupyBalance,
        upperLevel: uplineData.balance || 0,
        availableBalanceWithProfitLoss: this.calculateAvailableBalanceWithProfitLoss(user),
        downLevelCreditReference: downlineData.totalCreditRef || 0,
        downLevelProfitLoss: parseFloat(String(downlineDataWithCommissions.totalDownlineProfitLoss)) || 0, // Total downline profit/loss
        myProfitLoss: parseFloat(String(myAccurateProfitLoss)) || 0, // Own profit/loss from account transactions
        // Enhanced commission and downline data
        commissionEarned: parseFloat(String(downlineDataWithCommissions.commissionEarned)) || 0,
        directDownlineProfitLoss: parseFloat(String(downlineDataWithCommissions.directDownlineProfitLoss)) || 0,
        totalDownlineCount: downlineDataWithCommissions.downlineCount || 0,
        directDownlineCount: downlineDataWithCommissions.directDownlineCount || 0,
        netPosition: parseFloat(String(netPosition)) || 0, // Own profit/loss + commissions
      };
    } catch (error) {
      console.error('Error getting balance dashboard:', error);
      throw error;
    }
  }

  /**
   * Transfer balance between users
   */
  async transferBalance(request: BalanceTransferRequest): Promise<{ success: boolean; message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromUser = await this.findUserById(request.fromUserId);
      const toUser = await this.findUserById(request.toUserId);

      if (!fromUser || !toUser) {
        throw new Error('One or both users not found');
      }

      // Validate transfer
      if (request.amount <= 0) {
        throw new Error('Transfer amount must be positive');
      }

      if (request.transferType === 'credit' && fromUser.balance < request.amount) {
        throw new Error('Insufficient balance for transfer');
      }

      // Perform transfer
      switch (request.transferType) {
        case 'credit':
          fromUser.balance -= request.amount;
          toUser.balance += request.amount;
          break;
        
        case 'debit':
          toUser.balance -= request.amount;
          fromUser.balance += request.amount;
          break;
        
        case 'settlement':
          // Settlement transfer - adjust uplineSettlement
          fromUser.uplineSettlement -= request.amount;
          toUser.uplineSettlement += request.amount;
          break;
      }

      // Save changes
      await queryRunner.manager.save(fromUser);
      await queryRunner.manager.save(toUser);

      // Log transaction
      await this.logBalanceTransaction({
        fromUserId: request.fromUserId,
        toUserId: request.toUserId,
        amount: request.amount,
        transferType: request.transferType,
        remarks: request.remarks || `Balance transfer: ${request.transferType}`
      });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: `Successfully transferred ${request.amount} via ${request.transferType}`
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error transferring balance:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Update credit reference for a user
   */
  async updateCreditReference(update: CreditReferenceUpdate): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.findUserById(update.userId);
      if (!user) {
        throw new Error(`User ${update.userId} not found`);
      }

      const oldCreditRef = user.creditRef;
      user.creditRef = update.newCreditRef;

      await this.dataSource.manager.save(user);

      // Log the change
      await this.logBalanceTransaction({
        fromUserId: update.userId,
        toUserId: update.userId,
        amount: update.newCreditRef - oldCreditRef,
        transferType: 'credit',
        remarks: update.remarks || `Credit reference updated from ${oldCreditRef} to ${update.newCreditRef}`
      });

      return {
        success: true,
        message: `Credit reference updated from ${oldCreditRef} to ${update.newCreditRef}`
      };
    } catch (error) {
      console.error('Error updating credit reference:', error);
      throw error;
    }
  }

  /**
   * Adjust user balance (add, subtract, or set)
   */
  async adjustBalance(adjustment: BalanceAdjustment): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.findUserById(adjustment.userId);
      if (!user) {
        throw new Error(`User ${adjustment.userId} not found`);
      }

      const oldValue = user[adjustment.adjustmentType];
      let newValue: number;

      switch (adjustment.operation) {
        case 'add':
          newValue = oldValue + adjustment.amount;
          break;
        case 'subtract':
          newValue = oldValue - adjustment.amount;
          break;
        case 'set':
          newValue = adjustment.amount;
          break;
        default:
          throw new Error('Invalid operation');
      }

      user[adjustment.adjustmentType] = newValue;
      await this.dataSource.manager.save(user);

      // Log the adjustment
      await this.logBalanceTransaction({
        fromUserId: adjustment.userId,
        toUserId: adjustment.userId,
        amount: adjustment.amount,
        transferType: 'credit',
        remarks: adjustment.remarks || `${adjustment.adjustmentType} ${adjustment.operation}: ${oldValue} → ${newValue}`
      });

      return {
        success: true,
        message: `${adjustment.adjustmentType} ${adjustment.operation}: ${oldValue} → ${newValue}`
      };
    } catch (error) {
      console.error('Error adjusting balance:', error);
      throw error;
    }
  }

  /**
   * Get balance history for a user
   */
  async getBalanceHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      // This would typically query a balance_transactions table
      // For now, return a placeholder structure
      return [
        {
          id: '1',
          userId,
          transactionType: 'transfer',
          amount: 1000,
          balance: 5000,
          remarks: 'Balance transfer',
          createdAt: new Date()
        }
      ];
    } catch (error) {
      console.error('Error getting balance history:', error);
      throw error;
    }
  }

  /**
   * Calculate downline balances
   */
  private async calculateDownlineBalances(userId: string, userType: string): Promise<any> {
    try {
      const downlineTypes = this.getDownlineTypes(userType);
      let totalOccupyBalance = 0;
      let totalCreditRef = 0;
      // totalProfitLoss removed - using accurate calculation instead

      console.log(`[BALANCE-MANAGEMENT] Calculating downline balances for ${userType}(${userId})`);
      console.log(`[BALANCE-MANAGEMENT] Downline types: ${JSON.stringify(downlineTypes)}`);

      for (const downlineType of downlineTypes) {
        const repo = this.userRepos.get(downlineType);
        console.log(`[BALANCE-MANAGEMENT] Checking ${downlineType} repository: ${repo ? 'found' : 'not found'}`);
        
        if (repo) {
          const downlineUsers = await repo.find({
            where: { uplineId: userId }
          });

          console.log(`[BALANCE-MANAGEMENT] Found ${downlineUsers.length} ${downlineType} users for uplineId: ${userId}`);
          
          if (downlineUsers.length > 0) {
            console.log(`[BALANCE-MANAGEMENT] Sample ${downlineType} user:`, {
              id: downlineUsers[0].id,
              loginId: downlineUsers[0].loginId,
              balance: downlineUsers[0].balance,
              liability: downlineUsers[0].liability,
              exposure: downlineUsers[0].exposure,
              creditRef: downlineUsers[0].creditRef,
              profitLoss: downlineUsers[0].profitLoss,
              downLevelOccupyBalance: downlineUsers[0].downLevelOccupyBalance
            });
          }

          for (const user of downlineUsers) {
            // For users that have downLevelOccupyBalance field (like Agent), use it directly
            // For others, calculate it as balance + liability + exposure
            let userOccupyBalance = 0;
            
            if (user.downLevelOccupyBalance !== undefined) {
              userOccupyBalance = user.downLevelOccupyBalance || 0;
              console.log(`[BALANCE-MANAGEMENT] Using existing downLevelOccupyBalance: ${userOccupyBalance}`);
            } else {
              // Calculate occupy balance for users without the field
              userOccupyBalance = (user.balance || 0) - (user.exposure || 0);
              console.log(`[BALANCE-MANAGEMENT] Calculated occupy balance: ${user.balance || 0} - ${user.exposure || 0} = ${userOccupyBalance}`);
            }

            totalOccupyBalance += userOccupyBalance;
            totalCreditRef += Number(user.creditRef) || 0;
            // Don't use user.profitLoss from database - use accurate calculation instead
            // totalProfitLoss += Number(user.profitLoss) || 0;

            console.log(`[BALANCE-MANAGEMENT] ${downlineType}(${user.id}): occupy=${userOccupyBalance}, credit=${user.creditRef}, p/l=${user.profitLoss}`);
          }
        }
      }

      console.log(`[BALANCE-MANAGEMENT] Total downline: occupy=${totalOccupyBalance}, credit=${totalCreditRef}`);

      return {
        totalOccupyBalance,
        totalCreditRef
      };
    } catch (error) {
      console.error('Error calculating downline balances:', error);
      return { totalOccupyBalance: 0, totalCreditRef: 0 };
    }
  }

  /**
   * Calculate upline data
   */
  private async calculateUplineData(userId: string, userType: string): Promise<any> {
    try {
      const user = await this.findUserById(userId, userType);
      if (!user || !user.uplineId) {
        return { creditRef: 0, balance: 0 };
      }

      const uplineUser = await this.findUserById(user.uplineId);
      return {
        creditRef: uplineUser?.creditRef || 0,
        balance: uplineUser?.balance || 0
      };
    } catch (error) {
      console.error('Error calculating upline data:', error);
      return { creditRef: 0, balance: 0 };
    }
  }

  /**
   * Calculate upper level occupy balance
   * This represents how much balance the current user is occupying from their upline
   */
  private async calculateUpperLevelOccupyBalance(userId: string, userType: string): Promise<number> {
    try {
      const user = await this.findUserById(userId, userType);
      if (!user) {
        return 0;
      }

      // Upper level occupy balance is typically calculated as:
      // Current user's balance + liability + exposure
      // This represents how much of the upline's resources this user is using
      const upperLevelOccupyBalance = (user.balance || 0) - (user.exposure || 0);
      
      console.log(`[BALANCE-MANAGEMENT] Upper level occupy balance for ${userType}(${userId}): ${upperLevelOccupyBalance}`);
      
      return upperLevelOccupyBalance;
    } catch (error) {
      console.error('Error calculating upper level occupy balance:', error);
      return 0;
    }
  }

  /**
   * Calculate available balance
   */
  private calculateAvailableBalance(user: any): number {
    return (user.balance || 0) - (user.liability || 0);
  }

  /**
   * Calculate available balance with profit/loss
   */
  private calculateAvailableBalanceWithProfitLoss(user: any): number {
    return this.calculateAvailableBalance(user) + (user.profitLoss || 0);
  }

  /**
   * Get downline types for a user type
   */
  private getDownlineTypes(userType: string): string[] {
    const downlineMapping: Record<string, string[]> = {
      'techAdmin': ['admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'],
      'techadmin': ['admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'],
      'admin': ['miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client'],
      'miniAdmin': ['superMaster', 'master', 'superAgent', 'agent', 'client'],
      'minadmin': ['superMaster', 'master', 'superAgent', 'agent', 'client'],
      'superMaster': ['master', 'superAgent', 'agent', 'client'],
      'supermaster': ['master', 'superAgent', 'agent', 'client'],
      'master': ['superAgent', 'agent', 'client'],
      'superAgent': ['agent', 'client'],
      'superagent': ['agent', 'client'],
      'agent': ['client'],
      'client': []
    };

    const result = downlineMapping[userType] || [];
    console.log(`[BALANCE-MANAGEMENT] getDownlineTypes(${userType}) = ${JSON.stringify(result)}`);
    return result;
  }

  /**
   * Find user by ID across all user types
   */
  private async findUserById(userId: string, userType?: string): Promise<any> {
    if (userType && this.userRepos.has(userType)) {
      return await this.userRepos.get(userType)!.findOne({
        where: { id: userId }
      });
    }

    // Search across all user types
    for (const [type, repo] of this.userRepos) {
      const user = await repo.findOne({
        where: { id: userId }
      });
      if (user) {
        user.__type = type;
        return user;
      }
    }

    return null;
  }

  /**
   * Log balance transaction
   */
  private async logBalanceTransaction(transaction: any): Promise<void> {
    try {
      // This would typically save to a balance_transactions table
      console.log('[BALANCE-MANAGEMENT] Transaction logged:', transaction);
    } catch (error) {
      console.error('Error logging balance transaction:', error);
    }
  }
}
