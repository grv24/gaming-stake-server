import { DataSource, Repository } from 'typeorm';
import { CommissionTransaction, CommissionType, CommissionStatus, SportType } from '../entities/CommissionTransaction';
import { TechAdmin } from '../entities/users/TechAdminUser';
import { Admin } from '../entities/users/AdminUser';
import { MiniAdmin } from '../entities/users/MiniAdminUser';
import { SuperMaster } from '../entities/users/SuperMasterUser';
import { Master } from '../entities/users/MasterUser';
import { SuperAgent } from '../entities/users/SuperAgentUser';
import { Agent } from '../entities/users/AgentUser';
import { Client } from '../entities/users/ClientUser';

export interface CommissionCalculationResult {
  totalCommission: number;
  commissionBreakdown: Array<{
    userId: string;
    userType: string;
    userLoginId: string;
    commissionRate: number;
    commissionAmount: number;
    commissionType: CommissionType;
  }>;
}

export interface UserHierarchy {
  userId: string;
  userType: string;
  userLoginId: string;
  commissionRate: number;
  partnershipRate: number;
  uplineId?: string;
}

export class CommissionService {
  private dataSource: DataSource;
  private commissionTransactionRepo: Repository<CommissionTransaction>;
  
  // Performance optimization: Add caching
  private userCache = new Map<string, any>();
  private hierarchyCache = new Map<string, UserHierarchy[]>();
  private commissionRateCache = new Map<string, number>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.commissionTransactionRepo = dataSource.getRepository(CommissionTransaction);
    
    // Clear cache every 10 minutes to prevent memory leaks
    setInterval(() => {
      this.clearExpiredCache();
    }, 10 * 60 * 1000);
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, expiry] of this.cacheExpiry.entries()) {
      if (now > expiry) {
        this.userCache.delete(key);
        this.hierarchyCache.delete(key);
        this.commissionRateCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
  }

  /**
   * Set cache with expiry
   */
  private setCache<T>(cache: Map<string, T>, key: string, value: T): void {
    cache.set(key, value);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Get from cache if not expired
   */
  private getCache<T>(cache: Map<string, T>, key: string): T | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      cache.delete(key);
      this.cacheExpiry.delete(key);
      return null;
    }
    return cache.get(key) || null;
  }

  /**
   * Calculate commission for a bet based on user hierarchy
   */
  async calculateCommission(
    betId: string,
    userId: string,
    betAmount: number,
    sportType: SportType,
    commissionType: CommissionType = CommissionType.PANEL
  ): Promise<CommissionCalculationResult> {
    try {
      console.log(`[COMMISSION-SERVICE] Calculating commission for bet ${betId}, user ${userId}, amount ${betAmount}`);
      
      // Get user hierarchy
      const hierarchy = await this.getUserHierarchy(userId);
      
      console.log(`[COMMISSION-SERVICE] Found hierarchy:`, hierarchy.map(h => `${h.userType}(${h.userId})`));
      
      if (!hierarchy || hierarchy.length === 0) {
        throw new Error(`No hierarchy found for user ${userId}`);
      }

      const commissionBreakdown: CommissionCalculationResult['commissionBreakdown'] = [];
      let totalCommission = 0;

      // Calculate commission for each level in hierarchy
      for (const user of hierarchy) {
        const commissionRate = await this.getCommissionRate(
          user.userId,
          user.userType,
          sportType,
          commissionType
        );

        console.log(`[COMMISSION-SERVICE] User ${user.userType}(${user.userId}) commission rate: ${commissionRate}%`);

        if (commissionRate > 0) {
          const commissionAmount = (betAmount * commissionRate) / 100;
          
          commissionBreakdown.push({
            userId: user.userId,
            userType: user.userType,
            userLoginId: user.userLoginId,
            commissionRate,
            commissionAmount,
            commissionType
          });

          totalCommission += commissionAmount;
          
          console.log(`[COMMISSION-SERVICE] Added commission: ${commissionAmount} for ${user.userType}`);
        }
      }

      console.log(`[COMMISSION-SERVICE] Total commission calculated: ${totalCommission}`);

      return {
        totalCommission,
        commissionBreakdown
      };
    } catch (error) {
      console.error('Error calculating commission:', error);
      throw error;
    }
  }

  /**
   * Get user hierarchy from bottom to top (with caching)
   */
  private async getUserHierarchy(userId: string): Promise<UserHierarchy[]> {
    // Check cache first
    const cachedHierarchy = this.getCache(this.hierarchyCache, userId);
    if (cachedHierarchy) {
      console.log(`[COMMISSION-SERVICE] Using cached hierarchy for user ${userId}`);
      return cachedHierarchy;
    }

    const hierarchy: UserHierarchy[] = [];
    let currentUserId = userId;

    while (currentUserId) {
      const user = await this.findUserById(currentUserId);
      
      if (!user) {
        break;
      }

      hierarchy.push({
        userId: user.id,
        userType: user.__type,
        userLoginId: user.loginId,
        commissionRate: 0, // Will be calculated later
        partnershipRate: 0, // Will be calculated later
        uplineId: user.uplineId
      });

      currentUserId = user.uplineId;
    }

    // Cache the hierarchy
    this.setCache(this.hierarchyCache, userId, hierarchy);
    console.log(`[COMMISSION-SERVICE] Cached hierarchy for user ${userId}: ${hierarchy.length} levels`);

    return hierarchy;
  }

  /**
   * Get commission rate for a specific user, sport, and commission type (with caching)
   */
  private async getCommissionRate(
    userId: string,
    userType: string,
    sportType: SportType,
    commissionType: CommissionType
  ): Promise<number> {
    try {
      // Check cache first
      const cacheKey = `${userId}-${sportType}-${commissionType}`;
      const cachedRate = this.getCache(this.commissionRateCache, cacheKey);
      if (cachedRate !== null) {
        console.log(`[COMMISSION-SERVICE] Using cached commission rate for ${userType}(${userId}): ${cachedRate}%`);
        return cachedRate;
      }

      const user = await this.findUserById(userId);
      
      if (!user) {
        console.log(`[COMMISSION-SERVICE] User ${userId} not found`);
        return 0;
      }

      console.log(`[COMMISSION-SERVICE] Checking commission for ${userType}(${userId}): commissionLena=${user.commissionLena}, commissionOwn=${user.commissionOwn}`);

      // Check if user can receive commission
      if (!user.commissionLena) {
        console.log(`[COMMISSION-SERVICE] User ${userType}(${userId}) cannot receive commission (commissionLena=false)`);
        this.setCache(this.commissionRateCache, cacheKey, 0);
        return 0;
      }

      let rate = 0;

      // Get commission rate based on type
      switch (commissionType) {
        case CommissionType.PANEL:
          rate = user.commissionOwn || 0;
          console.log(`[COMMISSION-SERVICE] Panel commission rate for ${userType}(${userId}): ${rate}%`);
          break;
        
        case CommissionType.MATCH:
          rate = await this.getMatchCommissionRate(user, sportType);
          console.log(`[COMMISSION-SERVICE] Match commission rate for ${userType}(${userId}): ${rate}%`);
          break;
        
        case CommissionType.SESSION:
          rate = await this.getSessionCommissionRate(user, sportType);
          console.log(`[COMMISSION-SERVICE] Session commission rate for ${userType}(${userId}): ${rate}%`);
          break;
        
        default:
          console.log(`[COMMISSION-SERVICE] Unknown commission type: ${commissionType}`);
          rate = 0;
      }

      // Cache the rate
      this.setCache(this.commissionRateCache, cacheKey, rate);
      return rate;
    } catch (error) {
      console.error(`Error getting commission rate for user ${userId}:`, error);
      return 0;
    }
  }

  /**
   * Get match commission rate from sport settings
   */
  private async getMatchCommissionRate(user: any, sportType: SportType): Promise<number> {
    try {
      let settings = null;

      switch (sportType) {
        case SportType.SOCCER:
          settings = user.soccerSettings;
          break;
        case SportType.TENNIS:
          settings = user.tennisSettings;
          break;
        case SportType.CRICKET:
          settings = user.cricketSettings;
          break;
        case SportType.MATKA:
          settings = user.matkaSettings;
          break;
        case SportType.CASINO:
          settings = user.casinoSettings;
          break;
        case SportType.DIAMOND_CASINO:
          settings = user.internationalCasinoSettings;
          break;
      }

      return settings?.commissionOwn || 0;
    } catch (error) {
      console.error('Error getting match commission rate:', error);
      return 0;
    }
  }

  /**
   * Get session commission rate (Cricket only)
   */
  private async getSessionCommissionRate(user: any, sportType: SportType): Promise<number> {
    if (sportType !== SportType.CRICKET) {
      return 0;
    }

    try {
      const settings = user.cricketSettings;
      return settings?.sessionCommissionOwn || 0;
    } catch (error) {
      console.error('Error getting session commission rate:', error);
      return 0;
    }
  }

  /**
   * Find user by ID across all user types (OPTIMIZED with single query and caching)
   */
  private async findUserById(userId: string): Promise<any> {
    // Check cache first
    const cachedUser = this.getCache(this.userCache, userId);
    if (cachedUser) {
      console.log(`[COMMISSION-SERVICE] Using cached user data for ${userId}`);
      return cachedUser;
    }

    try {
      // Single optimized query with all relations
      const query = `
        SELECT 
          u.id, u.loginId, u.userName, u.uplineId, u.commissionLena, u.commissionDena,
          u.commissionOwn, u.partnershipOwn, u.balance, u.profitLoss, u.creditRef,
          u.exposure, u.exposureLimit, u.isActive, u.createdAt, u.updatedAt,
          s.commissionOwn as soccer_commission,
          t.commissionOwn as tennis_commission,
          c.commissionOwn as cricket_commission, c.sessionCommissionOwn as cricket_session_commission,
          m.commissionOwn as matka_commission,
          cas.commissionOwn as casino_commission,
          ic.commissionOwn as international_casino_commission,
          CASE 
            WHEN u.id IN (SELECT id FROM tech_admin) THEN 'techAdmin'
            WHEN u.id IN (SELECT id FROM admin) THEN 'admin'
            WHEN u.id IN (SELECT id FROM mini_admin) THEN 'miniAdmin'
            WHEN u.id IN (SELECT id FROM super_master) THEN 'superMaster'
            WHEN u.id IN (SELECT id FROM master) THEN 'master'
            WHEN u.id IN (SELECT id FROM super_agent) THEN 'superAgent'
            WHEN u.id IN (SELECT id FROM agent) THEN 'agent'
            WHEN u.id IN (SELECT id FROM client) THEN 'client'
            ELSE 'unknown'
          END as user_type
        FROM (
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM tech_admin WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM admin WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM mini_admin WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM super_master WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM master WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM super_agent WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM agent WHERE id = ?
          UNION ALL
          SELECT id, loginId, userName, uplineId, commissionLena, commissionDena,
                 commissionOwn, partnershipOwn, balance, profitLoss, creditRef,
                 exposure, exposureLimit, isActive, createdAt, updatedAt
          FROM client WHERE id = ?
        ) u
        LEFT JOIN soccer_settings s ON u.id = s.userId
        LEFT JOIN tennis_settings t ON u.id = t.userId
        LEFT JOIN cricket_settings c ON u.id = c.userId
        LEFT JOIN matka_settings m ON u.id = m.userId
        LEFT JOIN casino_settings cas ON u.id = cas.userId
        LEFT JOIN international_casino_settings ic ON u.id = ic.userId
        WHERE u.id = ?
        LIMIT 1
      `;

      const result = await this.dataSource.query(query, [
        userId, userId, userId, userId, userId, userId, userId, userId, userId
      ]);

      if (result && result.length > 0) {
        const user = result[0];
        
        // Structure the user object with settings
        const structuredUser = {
          id: user.id,
          loginId: user.loginId,
          userName: user.userName,
          uplineId: user.uplineId,
          commissionLena: user.commissionLena,
          commissionDena: user.commissionDena,
          commissionOwn: user.commissionOwn,
          partnershipOwn: user.partnershipOwn,
          balance: user.balance,
          profitLoss: user.profitLoss,
          creditRef: user.creditRef,
          exposure: user.exposure,
          exposureLimit: user.exposureLimit,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          __type: user.user_type,
          // Sport settings
          soccerSettings: user.soccer_commission ? { commissionOwn: user.soccer_commission } : null,
          tennisSettings: user.tennis_commission ? { commissionOwn: user.tennis_commission } : null,
          cricketSettings: user.cricket_commission ? { 
            commissionOwn: user.cricket_commission,
            sessionCommissionOwn: user.cricket_session_commission
          } : null,
          matkaSettings: user.matka_commission ? { commissionOwn: user.matka_commission } : null,
          casinoSettings: user.casino_commission ? { commissionOwn: user.casino_commission } : null,
          internationalCasinoSettings: user.international_casino_commission ? { 
            commissionOwn: user.international_casino_commission 
          } : null
        };

        // Cache the user
        this.setCache(this.userCache, userId, structuredUser);
        console.log(`[COMMISSION-SERVICE] Cached user data for ${userId} (${user.user_type})`);
        
        return structuredUser;
      }

      return null;
    } catch (error) {
      console.error(`[COMMISSION-SERVICE] Error finding user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Create commission transactions for a bet
   */
  async createCommissionTransactions(
    betId: string,
    userId: string,
    betAmount: number,
    sportType: SportType,
    commissionType: CommissionType = CommissionType.PANEL
  ): Promise<CommissionTransaction[]> {
    try {
      const calculation = await this.calculateCommission(
        betId,
        userId,
        betAmount,
        sportType,
        commissionType
      );

      const transactions: CommissionTransaction[] = [];

      for (const breakdown of calculation.commissionBreakdown) {
        const transaction = this.commissionTransactionRepo.create({
          betId,
          userId,
          userType: breakdown.userType,
          userLoginId: breakdown.userLoginId,
          uplineUserId: breakdown.userId,
          uplineUserType: breakdown.userType,
          uplineLoginId: breakdown.userLoginId,
          commissionType: breakdown.commissionType,
          sportType,
          betAmount,
          commissionRate: breakdown.commissionRate,
          commissionAmount: breakdown.commissionAmount,
          status: CommissionStatus.PENDING,
          remarks: `Commission for ${commissionType} bet on ${sportType}`
        });

        transactions.push(transaction);
      }

      return await this.commissionTransactionRepo.save(transactions);
    } catch (error) {
      console.error('Error creating commission transactions:', error);
      throw error;
    }
  }

  /**
   * Settle commission transactions
   */
  async settleCommissionTransactions(
    transactionIds: string[],
    settledBy: string
  ): Promise<CommissionTransaction[]> {
    try {
      const transactions = await this.commissionTransactionRepo.findByIds(transactionIds);
      
      if (transactions.length === 0) {
        throw new Error('No transactions found');
      }

      const settledTransactions: CommissionTransaction[] = [];

      for (const transaction of transactions) {
        if (!transaction.canBeSettled()) {
          continue;
        }

        // Update user balance
        await this.updateUserBalance(
          transaction.uplineUserId,
          transaction.commissionAmount
        );

        // Update transaction status
        transaction.status = CommissionStatus.SETTLED;
        transaction.settlementDate = new Date();
        transaction.settledAt = new Date();
        transaction.settledBy = settledBy;

        settledTransactions.push(transaction);
      }

      return await this.commissionTransactionRepo.save(settledTransactions);
    } catch (error) {
      console.error('Error settling commission transactions:', error);
      throw error;
    }
  }

  /**
   * Update user balance with commission amount
   */
  private async updateUserBalance(userId: string, commissionAmount: number): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      // Update balance and profit/loss
      user.balance = Number(user.balance) + commissionAmount;
      user.profitLoss = Number(user.profitLoss) + commissionAmount;

      // Save user
      const userRepo = this.dataSource.getRepository(user.constructor as any);
      await userRepo.save(user);
    } catch (error) {
      console.error(`Error updating balance for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get commission report for a user
   */
  async getCommissionReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCommission: number;
    commissionByType: Record<CommissionType, number>;
    commissionBySport: Record<SportType, number>;
    transactions: CommissionTransaction[];
  }> {
    try {
      const transactions = await this.commissionTransactionRepo.find({
        where: {
          uplineUserId: userId,
          createdAt: {
            $gte: startDate,
            $lte: endDate
          } as any
        },
        order: {
          createdAt: 'DESC'
        }
      });

      const totalCommission = transactions
        .filter(t => t.status === CommissionStatus.SETTLED)
        .reduce((sum, t) => sum + t.commissionAmount, 0);

      const commissionByType = transactions
        .filter(t => t.status === CommissionStatus.SETTLED)
        .reduce((acc, t) => {
          acc[t.commissionType] = (acc[t.commissionType] || 0) + t.commissionAmount;
          return acc;
        }, {} as Record<CommissionType, number>);

      const commissionBySport = transactions
        .filter(t => t.status === CommissionStatus.SETTLED)
        .reduce((acc, t) => {
          if (t.sportType) {
            acc[t.sportType] = (acc[t.sportType] || 0) + t.commissionAmount;
          }
          return acc;
        }, {} as Record<SportType, number>);

      return {
        totalCommission,
        commissionByType,
        commissionBySport,
        transactions
      };
    } catch (error) {
      console.error('Error getting commission report:', error);
      throw error;
    }
  }

  /**
   * Get pending commission transactions for settlement
   */
  async getPendingCommissionTransactions(): Promise<CommissionTransaction[]> {
    try {
      return await this.commissionTransactionRepo.find({
        where: {
          status: CommissionStatus.PENDING
        },
        order: {
          createdAt: 'ASC'
        }
      });
    } catch (error) {
      console.error('Error getting pending commission transactions:', error);
      throw error;
    }
  }

  /**
   * Validate commission configuration
   */
  async validateCommissionConfiguration(userId: string): Promise<string[]> {
    const errors: string[] = [];
    
    try {
      const user = await this.findUserById(userId);
      
      if (!user) {
        errors.push('User not found');
        return errors;
      }

      // Check commission rates
      if (user.commissionOwn < 0 || user.commissionOwn > 50) {
        errors.push('Own commission must be between 0-50%');
      }

      // Check upline commission
      if (user.uplineId) {
        const uplineUser = await this.findUserById(user.uplineId);
        if (uplineUser && user.commissionOwn > uplineUser.commissionOwn) {
          errors.push('Commission cannot be higher than upline');
        }
      }

      // Check partnership rates
      if (user.partnershipOwn < 0 || user.partnershipOwn > 100) {
        errors.push('Partnership must be between 0-100%');
      }

      return errors;
    } catch (error) {
      console.error('Error validating commission configuration:', error);
      errors.push('Error validating configuration');
      return errors;
    }
  }
}
