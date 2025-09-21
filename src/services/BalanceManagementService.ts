import { DataSource, Repository } from 'typeorm';
import { TechAdmin } from '../entities/users/TechAdminUser';
import { Admin } from '../entities/users/AdminUser';
import { MiniAdmin } from '../entities/users/MiniAdminUser';
import { SuperMaster } from '../entities/users/SuperMasterUser';
import { Master } from '../entities/users/MasterUser';
import { SuperAgent } from '../entities/users/SuperAgentUser';
import { Agent } from '../entities/users/AgentUser';
import { Client } from '../entities/users/ClientUser';
import { USER_TABLES } from '../Helpers/users/Roles';

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
   * Get balance dashboard for a user
   */
  async getBalanceDashboard(userId: string, userType: string): Promise<BalanceDashboard> {
    try {
      const user = await this.findUserById(userId, userType);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Calculate downline balances
      const downlineData = await this.calculateDownlineBalances(userId, userType);
      
      // Calculate upline data
      const uplineData = await this.calculateUplineData(userId, userType);

      // Calculate upper level occupy balance
      const upperLevelOccupyBalance = await this.calculateUpperLevelOccupyBalance(userId, userType);

      return {
        upperLevelCreditReference: uplineData.creditRef || 0,
        totalMasterBalance: user.balance || 0,
        availableBalance: this.calculateAvailableBalance(user),
        downLevelOccupyBalance: downlineData.totalOccupyBalance || 0,
        upperLevelOccupyBalance: upperLevelOccupyBalance,
        upperLevel: uplineData.balance || 0,
        availableBalanceWithProfitLoss: this.calculateAvailableBalanceWithProfitLoss(user),
        downLevelCreditReference: downlineData.totalCreditRef || 0,
        downLevelProfitLoss: downlineData.totalProfitLoss || 0,
        myProfitLoss: user.profitLoss || 0
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
      let totalProfitLoss = 0;

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
              userOccupyBalance = (user.balance || 0) + (user.liability || 0) + (user.exposure || 0);
              console.log(`[BALANCE-MANAGEMENT] Calculated occupy balance: ${user.balance || 0} + ${user.liability || 0} + ${user.exposure || 0} = ${userOccupyBalance}`);
            }

            totalOccupyBalance += userOccupyBalance;
            totalCreditRef += user.creditRef || 0;
            totalProfitLoss += user.profitLoss || 0;

            console.log(`[BALANCE-MANAGEMENT] ${downlineType}(${user.id}): occupy=${userOccupyBalance}, credit=${user.creditRef}, p/l=${user.profitLoss}`);
          }
        }
      }

      console.log(`[BALANCE-MANAGEMENT] Total downline: occupy=${totalOccupyBalance}, credit=${totalCreditRef}, p/l=${totalProfitLoss}`);

      return {
        totalOccupyBalance,
        totalCreditRef,
        totalProfitLoss
      };
    } catch (error) {
      console.error('Error calculating downline balances:', error);
      return { totalOccupyBalance: 0, totalCreditRef: 0, totalProfitLoss: 0 };
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
      const upperLevelOccupyBalance = (user.balance || 0) + (user.liability || 0) + (user.exposure || 0);
      
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
