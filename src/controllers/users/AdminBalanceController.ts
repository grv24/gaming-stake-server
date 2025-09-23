import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { USER_TABLES } from '../../Helpers/users/Roles';
import { TechAdmin } from '../../entities/users/TechAdminUser';
import { Admin } from '../../entities/users/AdminUser';
import { MiniAdmin } from '../../entities/users/MiniAdminUser';
import { SuperMaster } from '../../entities/users/SuperMasterUser';
import { Master } from '../../entities/users/MasterUser';
import { SuperAgent } from '../../entities/users/SuperAgentUser';
import { Agent } from '../../entities/users/AgentUser';
import { Client } from '../../entities/users/ClientUser';
import { AccountTrasaction } from '../../entities/Transactions/AccountTransactions';
import { CommissionTransaction } from '../../entities/CommissionTransaction';
import { SoccerSettings } from '../../entities/users/utils/SoccerSetting';
import { CricketSettings } from '../../entities/users/utils/CricketSetting';
import { TennisSettings } from '../../entities/users/utils/TennisSetting';
import { MatkaSettings } from '../../entities/users/utils/MatkaSetting';
import { CasinoSettings } from '../../entities/users/utils/CasinoSetting';
import { InternationalCasinoSettings } from '../../entities/users/utils/InternationalCasino';

// Helper function to calculate accurate profit/loss from account transactions
async function calculateUserProfitLoss(userId: string): Promise<number> {
  try {
    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    
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

// Enhanced function to calculate downline profit/loss with commission structure
async function calculateDownlineProfitLossWithCommissions(userId: string, userType: string): Promise<{
  directDownlineProfitLoss: number;
  totalDownlineProfitLoss: number;
  commissionEarned: number;
  downlineCount: number;
  directDownlineCount: number;
}> {
  try {
    const downlineTypes = getDownlineTypes(userType);
    let directDownlineProfitLoss = 0;
    let totalDownlineProfitLoss = 0;
    let directDownlineCount = 0;
    let totalDownlineCount = 0;
    let commissionEarned = 0;

    // Get commission transactions for this user to read commissionEarned from commissionFlow
    const commissionRepo = AppDataSource.getRepository(CommissionTransaction);
    
    console.log(`[COMMISSION-DEBUG] Querying commission transactions for userId: ${userId}, userType: ${userType}`);
    
    const commissionTransactions = await commissionRepo.find({
      where: { userId: userId }
    });

    console.log(`[COMMISSION-DEBUG] Found ${commissionTransactions.length} commission transactions for user ${userId}`);
    
    // Also try querying by uplineUserId to see if there are transactions where this user is the upline
    const uplineTransactions = await commissionRepo.find({
      where: { uplineUserId: userId }
    });
    
    console.log(`[COMMISSION-DEBUG] Found ${uplineTransactions.length} commission transactions where user ${userId} is upline`);
    
    // Combine both sets of transactions
    const allTransactions = [...commissionTransactions, ...uplineTransactions];
    console.log(`[COMMISSION-DEBUG] Total transactions to process: ${allTransactions.length}`);

    // Sum up commissionEarned from commissionFlow metadata
    for (const transaction of allTransactions) {
      console.log(`[COMMISSION-DEBUG] Processing transaction ${transaction.id}: userId=${transaction.userId}, uplineUserId=${transaction.uplineUserId}`);
      console.log(`[COMMISSION-DEBUG] Transaction metadata = ${JSON.stringify(transaction.metadata)}`);
      
      if (transaction.metadata && transaction.metadata.commissionFlow) {
        const commissionFlow = transaction.metadata.commissionFlow;
        console.log(`[COMMISSION-DEBUG] CommissionFlow for ${userType}: ${JSON.stringify(commissionFlow[userType])}`);
        
        const userCommissionData = commissionFlow[userType];
        
        if (userCommissionData && userCommissionData.commissionEarned !== undefined) {
          const transactionCommission = parseFloat(String(userCommissionData.commissionEarned)) || 0;
          commissionEarned += transactionCommission;
          console.log(`[COMMISSION-DEBUG] Transaction ${transaction.id}: ${userType} commissionEarned = ${userCommissionData.commissionEarned}, Added = ${transactionCommission}, Total = ${commissionEarned}`);
        } else {
          console.log(`[COMMISSION-DEBUG] Transaction ${transaction.id}: No commissionEarned data for ${userType}`);
        }
      } else {
        console.log(`[COMMISSION-DEBUG] Transaction ${transaction.id}: No commissionFlow in metadata`);
      }
    }

    // Calculate direct downline profit/loss
    for (const downlineType of downlineTypes) {
      const repo = AppDataSource.getRepository(USER_TABLES[downlineType]);
      const directDownlines = await repo.find({
        where: { uplineId: userId }
      });

      directDownlineCount += directDownlines.length;

      for (const downline of directDownlines) {
        const userProfitLoss = await calculateUserProfitLoss(downline.id);
        const profitLossAmt = parseFloat(String(userProfitLoss)) || 0;
        directDownlineProfitLoss = parseFloat(String(directDownlineProfitLoss)) + profitLossAmt;
        
        // Commission is now calculated from commissionFlow metadata above
        
        // Recursively calculate total downline profit/loss
        const recursiveResult = await calculateDownlineProfitLossWithCommissions(downline.id, downlineType);
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
    console.error('Error calculating downline profit/loss with commissions:', error);
    return { directDownlineProfitLoss: 0, totalDownlineProfitLoss: 0, commissionEarned: 0, downlineCount: 0, directDownlineCount: 0 };
  }
}

// Helper function to get stored commission rate from user settings
async function getStoredCommissionRate(downlineUserId: string, downlineType: string, uplineUserId: string): Promise<number> {
  try {
    // Get the downline user to access their settings
    const downlineUser = await getUserById(downlineUserId, downlineType);
    if (!downlineUser) {
      return 0;
    }

    // Check different settings tables for commission rates
    const settingsTables = [
      { repo: AppDataSource.getRepository(SoccerSettings), field: 'soccerSettingId' },
      { repo: AppDataSource.getRepository(CricketSettings), field: 'cricketSettingId' },
      { repo: AppDataSource.getRepository(TennisSettings), field: 'tennisSettingId' },
      { repo: AppDataSource.getRepository(MatkaSettings), field: 'matkaSettingId' },
      { repo: AppDataSource.getRepository(CasinoSettings), field: 'casinoSettingId' },
      { repo: AppDataSource.getRepository(InternationalCasinoSettings), field: 'internationalCasinoSettingId' }
    ];

    for (const { repo, field } of settingsTables) {
      const settingId = (downlineUser as any)[field];
      if (settingId) {
        const setting = await repo.findOne({
          where: { id: settingId }
        });
        
        if (setting && setting.commissionUplineUserId === uplineUserId) {
          return setting.commissionUpline || 0;
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

// Helper function to get commission rate based on user types (fallback)
function getCommissionRate(uplineType: string, downlineType: string): number {
  const commissionRates: Record<string, Record<string, number>> = {
    'techAdmin': {
      'admin': 5,
      'miniAdmin': 4,
      'superMaster': 3,
      'master': 2,
      'superAgent': 1.5,
      'agent': 1,
      'client': 0.5
    },
    'admin': {
      'miniAdmin': 4,
      'superMaster': 3,
      'master': 2,
      'superAgent': 1.5,
      'agent': 1,
      'client': 0.5
    },
    'miniAdmin': {
      'superMaster': 3,
      'master': 2,
      'superAgent': 1.5,
      'agent': 1,
      'client': 0.5
    },
    'superMaster': {
      'master': 2,
      'superAgent': 1.5,
      'agent': 1,
      'client': 0.5
    },
    'master': {
      'superAgent': 1.5,
      'agent': 1,
      'client': 0.5
    },
    'superAgent': {
      'agent': 1,
      'client': 0.5
    },
    'agent': {
      'client': 0.5
    }
  };

  return commissionRates[uplineType]?.[downlineType] || 0;
}

export const getAdminBalanceDashboard = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const currentUserType = req.user?.__type;

    if (!currentUserId || !currentUserType) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized. Please login to access this endpoint.",
      });
    }

    console.log(`[ADMIN-BALANCE] Enhanced dashboard request for ${currentUserType}(${currentUserId})`);

    // Only allow Admin and TechAdmin access
    if (!['admin', 'techAdmin'].includes(currentUserType)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Only Admin and TechAdmin can access this endpoint.",
      });
    }

    // Get the current user
    const currentUser = await getUserById(currentUserId, currentUserType);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Calculate balance metrics
    const balanceMetrics = await calculateBalanceMetrics(currentUserId, currentUserType);

    // Calculate accurate profit/loss for current user from account transactions
    const myAccurateProfitLoss = await calculateUserProfitLoss(currentUserId);

    // Calculate enhanced downline profit/loss with commissions
    const downlineData = await calculateDownlineProfitLossWithCommissions(currentUserId, currentUserType);

    // Calculate net position (own profit/loss + commissions earned)
    const netPosition = parseFloat(String(myAccurateProfitLoss)) + parseFloat(String(downlineData.commissionEarned || 0));

    // Format response to match frontend requirements with enhanced data
    const dashboardData = {
      upperLevelCreditReference: balanceMetrics.upperLevelCreditReference,
      totalMasterBalance: balanceMetrics.totalMasterBalance,
      availableBalance: balanceMetrics.availableBalance,
      downLevelOccupyBalance: balanceMetrics.downLevelOccupyBalance,
      upperLevel: balanceMetrics.upperLevel,
      availableBalanceWithProfitLoss: balanceMetrics.availableBalanceWithProfitLoss,
      downLevelCreditReference: balanceMetrics.downLevelCreditReference,
      downLevelProfitLoss: parseFloat(String(downlineData.totalDownlineProfitLoss)) || 0, // Total downline profit/loss
      myProfitLoss: parseFloat(String(myAccurateProfitLoss)) || 0, // Own profit/loss from account transactions
      upperLevelOccupyBalance: balanceMetrics.upperLevelOccupyBalance,
      // Enhanced commission and downline data
      commissionEarned: parseFloat(String(downlineData.commissionEarned)) || 0,
      directDownlineProfitLoss: parseFloat(String(downlineData.directDownlineProfitLoss)) || 0,
      totalDownlineCount: downlineData.downlineCount || 0,
      directDownlineCount: downlineData.directDownlineCount || 0,
      netPosition: parseFloat(String(netPosition)) || 0, // Own profit/loss + commissions
    };

    return res.status(200).json({
      success: true,
      data: dashboardData,
      message: "Balance dashboard retrieved successfully",
      userInfo: {
        userId: currentUserId,
        userType: currentUserType,
        userName: currentUser.userName || currentUser.loginId,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("Error getting admin balance dashboard:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getAdminBalanceSummary = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const currentUserType = req.user?.__type;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Only allow Admin and TechAdmin access
    if (!['admin', 'techAdmin'].includes(currentUserType)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Only Admin and TechAdmin can access this endpoint.",
      });
    }

    // Get balance metrics
    const balanceMetrics = await calculateBalanceMetrics(currentUserId, currentUserType);

    // Create summary with key metrics
    const summary = {
      currentBalance: balanceMetrics.totalMasterBalance,
      availableBalance: balanceMetrics.availableBalance,
      totalExposure: balanceMetrics.downLevelOccupyBalance,
      creditLimit: balanceMetrics.upperLevelCreditReference,
      downlineCount: balanceMetrics.downlineCount,
      totalDownlineBalance: balanceMetrics.downLevelOccupyBalance,
      netProfitLoss: balanceMetrics.myProfitLoss,
      downlineProfitLoss: balanceMetrics.downLevelProfitLoss,
      lastUpdated: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: summary,
      message: "Balance summary retrieved successfully"
    });

  } catch (error: any) {
    console.error("Error getting admin balance summary:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const checkAdminUser = async (req: Request, res: Response) => {
  try {
    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({
        success: false,
        error: "Login ID is required",
      });
    }

    // Find the admin user
    const adminRepo = AppDataSource.getRepository(Admin);
    const admin = await adminRepo.findOne({
      where: { loginId }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin user not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        loginId: admin.loginId,
        userName: admin.userName,
        isActive: admin.isActive,
        userLocked: admin.userLocked,
        whiteListId: admin.whiteListId,
        password: admin.user_password, // This will show the actual password
        uplineId: admin.uplineId,
      },
    });
  } catch (error) {
    console.error("Error checking admin user:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const activateAdminUser = async (req: Request, res: Response) => {
  try {
    const { loginId } = req.body;

    if (!loginId) {
      return res.status(400).json({
        success: false,
        error: "Login ID is required",
      });
    }

    // Find the admin user
    const adminRepo = AppDataSource.getRepository(Admin);
    const admin = await adminRepo.findOne({
      where: { loginId }
    });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Admin user not found",
      });
    }

    // Activate the admin user
    admin.isActive = true;
    await adminRepo.save(admin);

    return res.status(200).json({
      success: true,
      message: "Admin user activated successfully",
      data: {
        loginId: admin.loginId,
        userName: admin.userName,
        isActive: admin.isActive,
      },
    });
  } catch (error) {
    console.error("Error activating admin user:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const adjustAdminBalance = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    const currentUserType = req.user?.__type;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Only allow Admin and TechAdmin access
    if (!['admin', 'techAdmin'].includes(currentUserType)) {
      return res.status(403).json({
        success: false,
        error: "Access denied. Only Admin and TechAdmin can adjust balances.",
      });
    }

    const { targetUserId, adjustmentType, amount, operation, remarks } = req.body;

    // Validation
    if (!targetUserId || !adjustmentType || amount === undefined || !operation) {
      return res.status(400).json({
        success: false,
        error: "targetUserId, adjustmentType, amount, and operation are required"
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be non-negative"
      });
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return res.status(400).json({
        success: false,
        error: "Operation must be 'add', 'subtract', or 'set'"
      });
    }

    // Find target user
    const targetUser = await getUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: "Target user not found"
      });
    }

    // Perform balance adjustment
    const result = await performBalanceAdjustment(targetUser, adjustmentType, amount, operation, remarks);

    return res.status(200).json({
      success: true,
      data: result,
      message: `Balance ${adjustmentType} ${operation} successful`
    });

  } catch (error: any) {
    console.error("Error adjusting admin balance:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper Functions

async function getUserById(userId: string, userType?: string): Promise<any> {
  if (userType && USER_TABLES[userType]) {
    const repo = AppDataSource.getRepository(USER_TABLES[userType]);
    return await repo.findOne({ where: { id: userId } });
  }

  // Search across all user types
  for (const [type, entity] of Object.entries(USER_TABLES)) {
    const repo = AppDataSource.getRepository(entity);
    const user = await repo.findOne({ where: { id: userId } });
    if (user) {
      user.__type = type;
      return user;
    }
  }

  return null;
}

async function calculateBalanceMetrics(userId: string, userType: string): Promise<any> {
  try {
    const user = await getUserById(userId, userType);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Calculate downline balances
    const downlineData = await calculateDownlineBalances(userId, userType);
    
    // Calculate upline data
    const uplineData = await calculateUplineData(userId, userType);

    // Calculate upper level occupy balance
    const upperLevelOccupyBalance = await calculateUpperLevelOccupyBalance(userId, userType);

    return {
      upperLevelCreditReference: uplineData.creditRef || 0,
      totalMasterBalance: user.balance || 0,
      availableBalance: calculateAvailableBalance(user),
      downLevelOccupyBalance: downlineData.totalOccupyBalance || 0,
      upperLevel: uplineData.balance || 0,
      availableBalanceWithProfitLoss: calculateAvailableBalanceWithProfitLoss(user),
      downLevelCreditReference: downlineData.totalCreditRef || 0,
      downLevelProfitLoss: downlineData.totalProfitLoss || 0,
      myProfitLoss: user.profitLoss || 0,
      upperLevelOccupyBalance: upperLevelOccupyBalance,
      downlineCount: downlineData.downlineCount || 0
    };
  } catch (error) {
    console.error('Error calculating balance metrics:', error);
    throw error;
  }
}

async function calculateDownlineBalances(userId: string, userType: string): Promise<any> {
  try {
    const downlineTypes = getDownlineTypes(userType);
    let totalOccupyBalance = 0;
    let totalCreditRef = 0;
    let totalProfitLoss = 0;
    let downlineCount = 0;

    for (const downlineType of downlineTypes) {
      const repo = AppDataSource.getRepository(USER_TABLES[downlineType]);
      const downlineUsers = await repo.find({
        where: { uplineId: userId }
      });

      downlineCount += downlineUsers.length;

      for (const user of downlineUsers) {
        let userOccupyBalance = 0;
        
        if (user.downLevelOccupyBalance !== undefined) {
          userOccupyBalance = user.downLevelOccupyBalance || 0;
        } else {
          userOccupyBalance = (user.balance || 0) + (user.liability || 0) + (user.exposure || 0);
        }

        totalOccupyBalance += userOccupyBalance;
        totalCreditRef += user.creditRef || 0;
        
        // Calculate more accurate profit/loss from account transactions
        const userProfitLoss = await calculateUserProfitLoss(user.id);
        totalProfitLoss += userProfitLoss;
      }
    }

    return {
      totalOccupyBalance,
      totalCreditRef,
      totalProfitLoss,
      downlineCount
    };
  } catch (error) {
    console.error('Error calculating downline balances:', error);
    return { totalOccupyBalance: 0, totalCreditRef: 0, totalProfitLoss: 0, downlineCount: 0 };
  }
}

async function calculateUplineData(userId: string, userType: string): Promise<any> {
  try {
    const user = await getUserById(userId, userType);
    if (!user || !user.uplineId) {
      return { creditRef: 0, balance: 0 };
    }

    const uplineUser = await getUserById(user.uplineId);
    return {
      creditRef: uplineUser?.creditRef || 0,
      balance: uplineUser?.balance || 0
    };
  } catch (error) {
    console.error('Error calculating upline data:', error);
    return { creditRef: 0, balance: 0 };
  }
}

async function calculateUpperLevelOccupyBalance(userId: string, userType: string): Promise<number> {
  try {
    const user = await getUserById(userId, userType);
    if (!user) {
      return 0;
    }

    const upperLevelOccupyBalance = (user.balance || 0) + (user.liability || 0) + (user.exposure || 0);
    return upperLevelOccupyBalance;
  } catch (error) {
    console.error('Error calculating upper level occupy balance:', error);
    return 0;
  }
}

function calculateAvailableBalance(user: any): number {
  return (user.balance || 0) - (user.liability || 0);
}

function calculateAvailableBalanceWithProfitLoss(user: any): number {
  return calculateAvailableBalance(user) + (user.profitLoss || 0);
}

function getDownlineTypes(userType: string): string[] {
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

  return downlineMapping[userType] || [];
}

async function performBalanceAdjustment(user: any, adjustmentType: string, amount: number, operation: string, remarks?: string): Promise<any> {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const oldValue = user[adjustmentType];
    let newValue: number;

    switch (operation) {
      case 'add':
        newValue = oldValue + amount;
        break;
      case 'subtract':
        newValue = oldValue - amount;
        break;
      case 'set':
        newValue = amount;
        break;
      default:
        throw new Error('Invalid operation');
    }

    user[adjustmentType] = newValue;
    await queryRunner.manager.save(user);

    // Log the transaction
    console.log(`[BALANCE-ADJUSTMENT] ${adjustmentType} ${operation}: ${oldValue} → ${newValue} for user ${user.id}`);

    await queryRunner.commitTransaction();

    return {
      userId: user.id,
      adjustmentType,
      oldValue,
      newValue,
      amount,
      operation,
      remarks: remarks || `${adjustmentType} ${operation}: ${oldValue} → ${newValue}`,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}






