/**
 * Commission Calculation Service
 * Implements bottom-to-top commission flow for multi-level betting hierarchy
 */

export interface CommissionConfig {
  [userType: string]: {
    commissionOwn: number;      // Percentage kept by this user
    commissionUpline: number;   // Percentage passed to upline
    downlineTypes: string[];    // Types of users that can be downlines
  };
}

export interface CommissionResult {
  [userType: string]: {
    commissionEarned: number;
    profitLoss: number;
    downlineCount: number;
  };
}

export class CommissionCalculationService {
  private hierarchyConfig: CommissionConfig = {
    client: {
      commissionOwn: 0,
      commissionUpline: 0,
      downlineTypes: []
    },
    agent: {
      commissionOwn: 5,
      commissionUpline: 5,
      downlineTypes: ['client']
    },
    superAgent: {
      commissionOwn: 10,
      commissionUpline: 10,
      downlineTypes: ['agent']
    },
    master: {
      commissionOwn: 5,
      commissionUpline: 5,
      downlineTypes: ['superAgent']
    },
    superMaster: {
      commissionOwn: 10,
      commissionUpline: 10,
      downlineTypes: ['master']
    },
    miniAdmin: {
      commissionOwn: 10,
      commissionUpline: 10,
      downlineTypes: ['superMaster']
    },
    admin: {
      commissionOwn: 90,
      commissionUpline: 10,
      downlineTypes: ['miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client']
    },
    techAdmin: {
      commissionOwn: 100,
      commissionUpline: 0,
      downlineTypes: ['admin', 'miniAdmin', 'superMaster', 'master', 'superAgent', 'agent', 'client']
    }
  };

  /**
   * Calculate commission distribution for the entire hierarchy
   * @param baseAmount - Client's profit/loss amount
   * @param userHierarchy - Array of user types from bottom to top
   * @returns Commission distribution for each level
   */
  public calculateCommissionDistribution(
    baseAmount: number,
    userHierarchy: string[]
  ): CommissionResult {
    const result: CommissionResult = {};
    let currentAmount = baseAmount;

    // Process from bottom to top
    for (let i = 0; i < userHierarchy.length; i++) {
      const userType = userHierarchy[i];
      const config = this.hierarchyConfig[userType];
      
      if (!config) {
        console.warn(`No commission config found for user type: ${userType}`);
        continue;
      }

      // Special handling for TechAdmin
      if (userType === 'techAdmin') {
        // TechAdmin gets Admin's upline percentage directly
        const adminConfig = this.hierarchyConfig['admin'];
        const techAdminCommission = Math.abs(currentAmount) * (adminConfig.commissionUpline / 100);
        
        result[userType] = {
          commissionEarned: currentAmount < 0 ? techAdminCommission : -techAdminCommission,
          profitLoss: 0,
          downlineCount: 1
        };
        break;
      }

      // Calculate commission for current level
      const commissionOwn = Math.abs(currentAmount) * (config.commissionOwn / 100);
      const commissionUpline = Math.abs(currentAmount) * (config.commissionUpline / 100);
      
      // Commission sign: positive for losses, negative for wins
      const commissionEarned = currentAmount < 0 ? commissionOwn : -commissionOwn;
      
      result[userType] = {
        commissionEarned,
        profitLoss: currentAmount,
        downlineCount: 1
      };

      // Amount passed to upline
      currentAmount = currentAmount < 0 ? -commissionUpline : commissionUpline;
    }

    return result;
  }

  /**
   * Calculate commission for a specific user based on their downline's profit/loss
   * @param userType - Type of user (admin, agent, etc.)
   * @param downlineProfitLoss - Profit/loss from downline
   * @param userCommissionOwn - Commission own percentage from database (optional)
   * @param userCommissionUpline - Commission upline percentage from database (optional)
   * @returns Commission earned by this user
   */
  public calculateUserCommission(
    userType: string,
    downlineProfitLoss: number,
    userCommissionOwn?: number,
    userCommissionUpline?: number
  ): number {
    // Use database values if provided, otherwise fall back to config
    const commissionOwn = userCommissionOwn !== undefined ? userCommissionOwn : this.hierarchyConfig[userType]?.commissionOwn || 0;
    const commissionUpline = userCommissionUpline !== undefined ? userCommissionUpline : this.hierarchyConfig[userType]?.commissionUpline || 0;
    
    console.log(`[COMMISSION-CALC] ${userType}: commissionOwn=${commissionOwn}%, commissionUpline=${commissionUpline}%, profitLoss=${downlineProfitLoss}`);

    // Special handling for TechAdmin
    if (userType === 'techAdmin') {
      // TechAdmin gets Admin's upline commission (10%)
      const adminCommissionUpline = userCommissionUpline || 10; // Default to 10% if not provided
      const commission = Math.abs(downlineProfitLoss) * (adminCommissionUpline / 100);
      return downlineProfitLoss < 0 ? commission : -commission;
    }

    // Regular commission calculation using commissionOwn
    if (commissionOwn > 0) {
      const commission = Math.abs(downlineProfitLoss) * (commissionOwn / 100);
      return downlineProfitLoss < 0 ? commission : -commission;
    }

    return 0;
  }

  /**
   * Get commission configuration for a user type
   * @param userType - Type of user
   * @returns Commission configuration
   */
  public getCommissionConfig(userType: string) {
    return this.hierarchyConfig[userType];
  }

  /**
   * Update commission configuration
   * @param userType - Type of user
   * @param config - New commission configuration
   */
  public updateCommissionConfig(userType: string, config: Partial<CommissionConfig[string]>) {
    if (this.hierarchyConfig[userType]) {
      this.hierarchyConfig[userType] = { ...this.hierarchyConfig[userType], ...config };
    }
  }

  /**
   * Get the complete hierarchy configuration
   * @returns Complete hierarchy configuration
   */
  public getHierarchyConfig(): CommissionConfig {
    return { ...this.hierarchyConfig };
  }
}

// Export singleton instance
export const commissionCalculationService = new CommissionCalculationService();
