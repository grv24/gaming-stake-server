import { Request, Response } from "express";
import { AppDataSource } from "../../config/database";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { DOWNLINE_MAPPING } from "../../Helpers/users/Roles";
import { AccountTrasaction } from "../../entities/Transactions/AccountTransactions";
import { Whitelist } from "../../entities/whitelist/Whitelist";
import { TechAdmin } from "../../entities/users/TechAdminUser";
import { format } from "date-fns";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { Between, In } from "typeorm";
import { SportBet } from "../../entities/sports/SportBet";
import { CasinoMatchNew } from "../../entities/casino/CasinoMatchNew";
import { SoccerSettings } from "../../entities/users/utils/SoccerSetting";
import { CricketSettings } from "../../entities/users/utils/CricketSetting";
import { TennisSettings } from "../../entities/users/utils/TennisSetting";
import { MatkaSettings } from "../../entities/users/utils/MatkaSetting";
import { CasinoSettings } from "../../entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "../../entities/users/utils/InternationalCasino";

export const getPendingBet = async (req: Request, res: Response) => {
  const { type, page = 1, limit = 10, betType = 'all', search } = req.query;
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "User ID is required",
    });
  }
  
  if (!type) {
    return res.status(400).json({
      success: false,
      error: "Type is required",
    });
  }

  try {
    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const sportsBetRepo = AppDataSource.getRepository(SportBet);
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    let pendingBets: any[] = [];
    let totalCount = 0;
    let totalAmount = 0;

    if (type === "casino") {
      // Build query for casino bets
      let queryBuilder = casinoBetRepo.createQueryBuilder('bet')
        .where('bet.userId = :userId', { userId })
        .andWhere('bet.status = :status', { status: 'pending' })
        .orderBy('bet.createdAt', 'DESC')
        .skip(offset)
        .take(limitNum);

      // Add bet type filter if specified
      if (betType !== 'all') {
        queryBuilder.andWhere('bet.betData->>betType = :betType', { betType });
      }

      // Add search filter if specified
      if (search) {
        queryBuilder.andWhere('(bet.betData->>gameSlug ILIKE :search OR bet.matchId ILIKE :search)', { 
          search: `%${search}%` 
        });
      }

      const [bets, count] = await queryBuilder.getManyAndCount();
      pendingBets = bets.map((bet: any) => ({
        id: bet.id,
        eventName: bet.betData?.gameSlug || bet.betData?.casinoType || 'Unknown Game',
        nation: bet.betData?.betSid || bet.betData?.selection || 'Unknown',
        userRate: bet.betData?.betRate || bet.betData?.matchOdd || '1.00',
        amount: bet.betData?.stake || bet.betData?.amount || 0,
        placeDate: bet.createdAt.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        betType: bet.betData?.betType || 'back',
        matchId: bet.matchId,
        gameType: 'casino'
      }));
      
      totalCount = count;
      totalAmount = bets.reduce((sum: number, bet: any) => sum + (bet.betData?.stake || bet.betData?.amount || 0), 0);
      
    } else if (type === "sports") {
      // Build query for sports bets
      let queryBuilder = sportsBetRepo.createQueryBuilder('bet')
        .where('bet.userId = :userId', { userId })
        .andWhere('bet.status = :status', { status: 'pending' })
        .orderBy('bet.createdAt', 'DESC')
        .skip(offset)
        .take(limitNum);

      // Add bet type filter if specified
      if (betType !== 'all') {
        queryBuilder.andWhere('bet.betData->>betType = :betType', { betType });
      }

      // Add search filter if specified
      if (search) {
        queryBuilder.andWhere('(bet.betData->>eventName ILIKE :search OR bet.eventId ILIKE :search)', { 
          search: `%${search}%` 
        });
      }

      const [bets, count] = await queryBuilder.getManyAndCount();
      pendingBets = bets.map((bet: any) => ({
        id: bet.id,
        eventName: bet.betData?.eventName || bet.betData?.matchName || 'Unknown Event',
        nation: bet.betData?.selection || bet.betData?.teamName || bet.betData?.sId || 'Unknown',
        userRate: bet.betData?.odds || bet.betData?.betRate || '1.00',
        amount: bet.betData?.stake || bet.betData?.amount || 0,
        placeDate: bet.createdAt.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        betType: bet.betData?.betType || 'back',
        matchId: bet.eventId,
        gameType: 'sports'
      }));
      
      totalCount = count;
      totalAmount = bets.reduce((sum: number, bet: any) => sum + (bet.betData?.stake || bet.betData?.amount || 0), 0);
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      success: true,
      data: {
        bets: pendingBets,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalRecords: totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage
        },
        summary: {
          totalBets: totalCount,
          totalAmount: totalAmount
        },
        filters: {
          type: type,
          betType: betType,
          search: search || ''
        }
      }
    });
  } catch (error) {
    console.error("Error getting pending bet:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const addBalance = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const uplineId = req.user?.userId;
    const uplineBalance = req.user?.AccountDetails?.Balance;
    const uplineTransactionPassword = req.user?.transactionPassword;

    if (uplineBalance === undefined) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Upline balance is required",
      });
    }

    const { userId, userType, amount, remark, transactionPassword } = req.body;

    if (!userId || !userType || amount === undefined || amount <= 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Valid userId, userType and positive amount are required",
      });
    }

    if (transactionPassword !== uplineTransactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Incorrect transaction password",
      });
    }

    if (amount > uplineBalance) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Insufficient balance",
      });
    }

    const userRepository = queryRunner.manager.getRepository(
      USER_TABLES[userType]
    );
    if (!userRepository) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Invalid userType provided",
      });
    }

    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.uplineId !== uplineId) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: "This is not your direct downline user",
      });
    }

    const newBalance = Number(user.balance) + Number(amount);

    await userRepository.update(userId, {
      balance: newBalance,
      uplineSettlement: Number(user.uplineSettlement) + Number(amount),
    });

    const uplineRepository = queryRunner.manager.getRepository(
      USER_TABLES[req.user?.__type]
    );

    await uplineRepository.update(uplineId, {
      balance: Number(uplineBalance) - Number(amount),
    });

    const transactionRepo =
      queryRunner.manager.getRepository(AccountTrasaction);
    const accountTransaction = transactionRepo.create({
      uplineUserId: uplineId,
      downlineUserId: userId,
      remarks: remark || "Balance added",
      type: "deposit",
      amount,
    });
    await transactionRepo.save(accountTransaction);

    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Balance added successfully",
      data: {
        userId,
        userType,
        previousBalance: user.balance,
        addedAmount: amount,
        newBalance,
        transactionId: accountTransaction.id,
      },
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error("Error adding balance:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await queryRunner.release();
  }
};

export const withdrawBalance = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const uplineId = req.user?.userId;
    const uplineBalance = req.user?.AccountDetails?.Balance;
    const uplineTransactionPassword = req.user?.transactionPassword;

    const { userId, userType, amount, remark, transactionPassword } = req.body;

    if (!userId || !userType || amount === undefined || amount <= 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Valid userId, userType and positive amount are required",
      });
    }

    if (transactionPassword !== uplineTransactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Incorrect transaction password",
      });
    }

    const userRepository = queryRunner.manager.getRepository(
      USER_TABLES[userType]
    );
    if (!userRepository) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Invalid userType provided",
      });
    }

    const user = await userRepository.findOne({ where: { id: userId } });
    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (user.uplineId !== uplineId) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: "This is not your direct downline user",
      });
    }

    if (amount > user.balance - user.exposure) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Insufficient downline balance",
      });
    }

    // deduct from child balance
    const newDownlineBalance =
      Number(user.balance) - Number(user.exposure) - Number(amount);
    // user.uplineSettlement -= Number(amount);

    await userRepository.update(userId, {
      balance: newDownlineBalance,
      uplineSettlement: Number(user.uplineSettlement) - Number(amount),
    });

    // add to upline balance
    const uplineRepository = queryRunner.manager.getRepository(
      USER_TABLES[req.user?.__type]
    );
    const updatedUplineBalance = Number(uplineBalance) + Number(amount);
    await uplineRepository.update(uplineId, {
      balance: updatedUplineBalance,
    });

    // insert into AccountTransaction table
    const transactionRepo =
      queryRunner.manager.getRepository(AccountTrasaction);
    const accountTransaction = transactionRepo.create({
      uplineUserId: uplineId,
      downlineUserId: userId,
      remarks: remark || "Balance withdrawn",
      type: "withdraw",
      amount,
    });
    await transactionRepo.save(accountTransaction);

    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Balance withdrawn successfully",
      data: {
        userId,
        userType,
        previousBalance: user.balance,
        withdrawnAmount: amount,
        newBalance: newDownlineBalance,
        transactionId: accountTransaction.id,
      },
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error("Error withdrawing balance:", error);

    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await queryRunner.release();
  }
};

// export const lockUserAndDownlineMultiTable = async (req: Request, res: Response) => {
//     const { userId, userType, lockValue } = req.body;

//     if (!userId || !userType) {
//         return res.status(400).json({ message: "userId and userType are required" });
//     }

//     if (!USER_TABLES[userType]) {
//         return res.status(400).json({ message: `Unknown userType: ${userType}` });
//     }

//     try {
//         type UserRole = keyof typeof DOWNLINE_MAPPING;

//         const lockRecursive = async (id: string, currentType: UserRole) => {
//             const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

//             await repo.update(id, { userLocked: lockValue });

//             const childRoles = DOWNLINE_MAPPING[currentType];
//             if (!childRoles.length) return;

//             for (const role of childRoles) {
//                 const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
//                 const children = await childRepo.find({ where: { uplineId: id }, select: ["id"] });

//                 for (const child of children) {
//                     await lockRecursive(child.id, role as UserRole);
//                 }
//             }
//         };

//         await lockRecursive(userId, userType as UserRole);

//         return res.status(200).json({
//             status: true,
//             message: `User (${userType}) and all downline users have been locked.`
//         });
//     } catch (error) {
//         console.error("Error locking users:", error);
//         return res.status(500).json({ status: false, message: "Internal server error", error });
//     }
// };

// export const lockBetAndDownlineMultiTable = async (req: Request, res: Response) => {
//     const { userId, userType, lockValue } = req.body;

//     if (!userId || !userType) {
//         return res.status(400).json({ message: "userId and userType are required" });
//     }

//     if (!USER_TABLES[userType]) {
//         return res.status(400).json({ message: `Unknown userType: ${userType}` });
//     }

//     try {
//         type UserRole = keyof typeof DOWNLINE_MAPPING;

//         const lockRecursive = async (id: string, currentType: UserRole) => {
//             const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

//             await repo.update(id, { bettingLocked: lockValue });

//             const childRoles = DOWNLINE_MAPPING[currentType];
//             if (!childRoles.length) return;

//             for (const role of childRoles) {
//                 const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
//                 const children = await childRepo.find({ where: { uplineId: id }, select: ["id"] });

//                 for (const child of children) {
//                     await lockRecursive(child.id, role as UserRole);
//                 }
//             }
//         };

//         await lockRecursive(userId, userType as UserRole);

//         return res.status(200).json({
//             status: true,
//             message: `User (${userType}) and all downline users have been locked.`
//         });
//     } catch (error) {
//         console.error("Error locking users:", error);
//         return res.status(500).json({ status: false, message: "Internal server error", error });
//     }
// };

export const lockUserOrBetAndDownlineMultiTable = async (
  req: Request,
  res: Response
) => {
  const { userId, userType, userLockValue, betLockValue, transactionPassword } =
    req.body;

  if (!userId || !userType) {
    return res
      .status(400)
      .json({ message: "userId and userType are required" });
  }

  if (!USER_TABLES[userType]) {
    return res.status(400).json({ message: `Unknown userType: ${userType}` });
  }

  if (userLockValue === undefined && betLockValue === undefined) {
    return res
      .status(400)
      .json({
        message:
          "At least one of userLockValue or betLockValue must be provided",
      });
  }

  const uplineTransactionPassword = req.user?.transactionPassword;

  if (transactionPassword !== uplineTransactionPassword) {
    return res.status(400).json({
      success: false,
      error: "Incorrect transaction password",
    });
  }

  try {
    type UserRole = keyof typeof DOWNLINE_MAPPING;

    const lockRecursive = async (id: string, currentType: UserRole) => {
      const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

      const updateField: any = {};
      if (userLockValue !== undefined) {
        updateField.userLocked = userLockValue;
      }
      if (betLockValue !== undefined) {
        updateField.bettingLocked = betLockValue;
      }

      if (Object.keys(updateField).length > 0) {
        await repo.update(id, updateField);
      }

      const childRoles = DOWNLINE_MAPPING[currentType];
      if (!childRoles.length) return;

      for (const role of childRoles) {
        const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
        const children = await childRepo.find({
          where: { uplineId: id },
          select: ["id"],
        });

        for (const child of children) {
          await lockRecursive(child.id, role as UserRole);
        }
      }
    };

    await lockRecursive(userId, userType as UserRole);

    return res.status(200).json({
      status: true,
      message: `User (${userType}) and all downline users have been updated.`,
      appliedLocks: {
        ...(userLockValue !== undefined && { userLocked: userLockValue }),
        ...(betLockValue !== undefined && { bettingLocked: betLockValue }),
      },
    });
  } catch (error) {
    console.error("Error locking users:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", error });
  }
};

export const lockFancyAndDownlineMultiTable = async (
  req: Request,
  res: Response
) => {
  const { userId, userType, lockValue } = req.body;

  if (!userId || !userType) {
    return res
      .status(400)
      .json({ message: "userId and userType are required" });
  }

  if (!USER_TABLES[userType]) {
    return res.status(400).json({ message: `Unknown userType: ${userType}` });
  }

  try {
    type UserRole = keyof typeof DOWNLINE_MAPPING;

    const lockRecursive = async (id: string, currentType: UserRole) => {
      const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

      await repo.update(id, { fancyLocked: lockValue });

      const childRoles = DOWNLINE_MAPPING[currentType];
      if (!childRoles.length) return;

      for (const role of childRoles) {
        const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
        const children = await childRepo.find({
          where: { uplineId: id },
          select: ["id"],
        });

        for (const child of children) {
          await lockRecursive(child.id, role as UserRole);
        }
      }
    };

    await lockRecursive(userId, userType as UserRole);

    return res.status(200).json({
      status: true,
      message: `User (${userType}) and all downline users have been locked.`,
    });
  } catch (error) {
    console.error("Error locking users:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", error });
  }
};

export const getUserIp = async (req: Request, res: Response) => {
  try {
    // Get IP from various sources with better fallbacks
    let ip: string | undefined;
    
    // Try multiple IP detection methods
    const ipSources = [
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim(),
      req.headers["x-real-ip"]?.toString()?.trim(),
      req.headers["x-client-ip"]?.toString()?.trim(),
      req.headers["cf-connecting-ip"]?.toString()?.trim(), // Cloudflare
      req.headers["x-cluster-client-ip"]?.toString()?.trim(),
      req.socket.remoteAddress,
      req.ip,
      req.connection?.remoteAddress,
      req.socket?.remoteAddress
    ];

    // Find the first valid IP
    for (const source of ipSources) {
      if (source && source !== 'undefined' && source !== 'null') {
        ip = source;
        break;
      }
    }

    // Clean and format the IP address
    if (ip) {
      // Remove any port numbers
      ip = ip.split(':')[0];
      
      // Convert IPv6 localhost to IPv4 localhost for better readability
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1';
      }
      
      // Remove any brackets from IPv6 addresses
      ip = ip.replace(/[\[\]]/g, '');
      
      // Handle IPv4-mapped IPv6 addresses
      if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
      }
      
      // Additional IPv6 localhost variants
      if (ip === '0:0:0:0:0:0:0:1' || ip === '0000:0000:0000:0000:0000:0000:0000:0001') {
        ip = '127.0.0.1';
      }
    }

    // If still no IP found, provide a default localhost IP
    if (!ip || ip === 'undefined' || ip === 'null') {
      ip = '127.0.0.1'; // Default to localhost
    }

    // Additional IP information
    const isLocalhost = ip === '127.0.0.1' || ip === 'localhost';
    const ipVersion = ip.includes(':') ? 'IPv6' : 'IPv4';

    // Determine which source was used
    let detectedFrom = 'default';
    if (req.headers["x-forwarded-for"]) detectedFrom = 'x-forwarded-for';
    else if (req.headers["x-real-ip"]) detectedFrom = 'x-real-ip';
    else if (req.headers["x-client-ip"]) detectedFrom = 'x-client-ip';
    else if (req.headers["cf-connecting-ip"]) detectedFrom = 'cf-connecting-ip';
    else if (req.headers["x-cluster-client-ip"]) detectedFrom = 'x-cluster-client-ip';
    else if (req.socket.remoteAddress) detectedFrom = 'socket.remoteAddress';
    else if (req.ip) detectedFrom = 'req.ip';
    else if (req.connection?.remoteAddress) detectedFrom = 'connection.remoteAddress';

    return res.status(200).json({
      status: true,
      ip,
      ipVersion,
      isLocalhost,
      userAgent: req.headers['user-agent'] || 'Unknown',
      timestamp: new Date().toISOString(),
      debug: {
        detectedFrom,
        originalSources: {
          'x-forwarded-for': req.headers["x-forwarded-for"],
          'x-real-ip': req.headers["x-real-ip"],
          'x-client-ip': req.headers["x-client-ip"],
          'cf-connecting-ip': req.headers["cf-connecting-ip"],
          'x-cluster-client-ip': req.headers["x-cluster-client-ip"],
          'socket.remoteAddress': req.socket.remoteAddress,
          'req.ip': req.ip,
          'connection.remoteAddress': req.connection?.remoteAddress
        },
        allHeaders: Object.keys(req.headers).filter(key => 
          key.toLowerCase().includes('ip') || 
          key.toLowerCase().includes('forward') ||
          key.toLowerCase().includes('client') ||
          key.toLowerCase().includes('real')
        ).reduce((obj, key) => {
          obj[key] = req.headers[key];
          return obj;
        }, {} as any),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          isDevelopment: process.env.NODE_ENV === 'development',
          isProduction: process.env.NODE_ENV === 'production'
        }
      }
    });
  } catch (error) {
    console.error("Error fetching user IP:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error" });
  }
};

export const getAllDownlineUsers = async (req: Request, res: Response) => {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const userType = req.query.type as string;
    const includeSettings = req.query.includeSettings === 'true';

    // Validate user type if provided
    if (userType && !USER_TABLES[userType]) {
      return res.status(400).json({
        success: false,
        error: `Invalid user type. Valid types are: ${Object.keys(USER_TABLES).join(', ')}`,
      });
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

      // If specific user type is requested, only fetch that type
      const tablesToQuery = userType ? { [userType]: USER_TABLES[userType] } : USER_TABLES;

    let allUsers: any[] = [];
    let totalCount = 0;

    // Use database-level pagination for better performance
      for (const [type, entity] of Object.entries(tablesToQuery)) {
      try {
        const repo = AppDataSource.getRepository(entity);

        // Get total count for this table
        const count = await repo.count({ where: { uplineId: currentUserId } });
        totalCount += count;

        // Get paginated users from this table
        const children = await repo.find({
          where: { uplineId: currentUserId },
          skip: skip,
          take: limit,
          order: { createdAt: 'DESC' }
        });

        if (children.length === 0) continue;

        // Only load settings if explicitly requested
        let settingsMaps = {
          soccerSettingsMap: new Map(),
          cricketSettingsMap: new Map(),
          tennisSettingsMap: new Map(),
          matkaSettingsMap: new Map(),
          casinoSettingsMap: new Map(),
          internationalCasinoSettingsMap: new Map()
        };

        if (includeSettings) {
          // Collect all setting IDs for batch loading
          const soccerSettingIds = children.map((c: any) => c.soccerSettingId).filter(Boolean);
          const cricketSettingIds = children.map((c: any) => c.cricketSettingId).filter(Boolean);
          const tennisSettingIds = children.map((c: any) => c.tennisSettingId).filter(Boolean);
          const matkaSettingIds = children.map((c: any) => c.matkaSettingId).filter(Boolean);
          const casinoSettingIds = children.map((c: any) => c.casinoSettingId).filter(Boolean);
          const internationalCasinoSettingIds = children.map((c: any) => c.internationalCasinoSettingId).filter(Boolean);

          // Batch load all settings in parallel
          const [
            soccerSettingsMap,
            cricketSettingsMap,
            tennisSettingsMap,
            matkaSettingsMap,
            casinoSettingsMap,
            internationalCasinoSettingsMap
          ] = await Promise.all([
            soccerSettingIds.length > 0 ? 
              AppDataSource.getRepository(SoccerSettings).find({ where: { id: In(soccerSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map()),
            cricketSettingIds.length > 0 ? 
              AppDataSource.getRepository(CricketSettings).find({ where: { id: In(cricketSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map()),
            tennisSettingIds.length > 0 ? 
              AppDataSource.getRepository(TennisSettings).find({ where: { id: In(tennisSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map()),
            matkaSettingIds.length > 0 ? 
              AppDataSource.getRepository(MatkaSettings).find({ where: { id: In(matkaSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map()),
            casinoSettingIds.length > 0 ? 
              AppDataSource.getRepository(CasinoSettings).find({ where: { id: In(casinoSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map()),
            internationalCasinoSettingIds.length > 0 ? 
              AppDataSource.getRepository(InternationalCasinoSettings).find({ where: { id: In(internationalCasinoSettingIds) } })
                .then((settings: any) => new Map(settings.map((s: any) => [s.id, s]))) : 
              Promise.resolve(new Map())
          ]);

          settingsMaps = {
            soccerSettingsMap,
            cricketSettingsMap,
            tennisSettingsMap,
            matkaSettingsMap,
            casinoSettingsMap,
            internationalCasinoSettingsMap
          };
        }

        // Process users with optional settings
        for (const child of children) {
          const userData: any = {
            userId: child.id,
            PersonalDetails: {
              userName: child.userName,
              loginId: child.loginId,
              user_password: child.user_password,
              countryCode: child.countryCode,
              mobile: child.mobile,
              idIsActive: child.isActive,
              isAutoRegisteredUser: child.isAutoRegisteredUser,
            },
            transactionPassword: child.transactionPassword,
            whiteListId: child.whiteListId,
            IpAddress: child.IpAddress,
            uplineId: child.uplineId,
            fancyLocked: child.fancyLocked,
            bettingLocked: child.bettingLocked,
            userLocked: child.userLocked,
            __type: child.__type,
            remarks: child.remarks,
            AccountDetails: {
              liability: child.liability,
              Balance: child.balance,
              profitLoss: child.profitLoss,
              freeChips: child.freeChips,
              totalSettledAmount: child.totalSettledAmount,
              Exposure: child.exposure,
              ExposureLimit: child.exposureLimit,
              creditRef: child.creditRef,
            },
            allowedNoOfUsers: child.allowedNoOfUsers,
            createdUsersCount: child.createdUsersCount,
            commissionLenaYaDena: {
              commissionLena: child.commissionLena,
              commissionDena: child.commissionDena,
            },
            // Commission and Partnership Details
            commissionDetails: {
              percentageWiseCommission: child.percentageWiseCommission,
              partnerShipWiseCommission: child.partnerShipWiseCommission,
              commissionUplineType: child.commissionUplineType,
              commissionUplineUserId: child.commissionUplineUserId,
              commissionUpline: child.commissionUpline,
              commissionOwn: child.commissionOwn,
              partnershipUplineType: child.partnershipUplineType,
              partnershipUplineUserId: child.partnershipUplineUserId,
              partnershipUpline: child.partnershipUpline,
              partnershipOwn: child.partnershipOwn,
            },
            // Additional Admin Fields
            adminPermissions: {
              whiteListAccess: child.whiteListAccess,
              depositWithdrawlAccess: child.depositWithdrawlAccess,
              canDeleteBets: child.canDeleteBets,
              canDeleteUsers: child.canDeleteUsers,
              specialPermissions: child.specialPermissions,
              enableMultipleLogin: child.enableMultipleLogin,
              autoSignUpFeature: child.autoSignUpFeature,
              displayUsersOnlineStatus: child.displayUsersOnlineStatus,
              refundOptionFeature: child.refundOptionFeature,
              canDeclareResultAsOperator: child.canDeclareResultAsOperator,
            },
            groupID: child.groupID,
            createdAt: child.createdAt,
            updatedAt: child.updatedAt,
          };

          // Only add settings if requested
          if (includeSettings) {
            userData.soccerSettings = child.soccerSettingId ? settingsMaps.soccerSettingsMap.get(child.soccerSettingId) || null : null;
            userData.cricketSettings = child.cricketSettingId ? settingsMaps.cricketSettingsMap.get(child.cricketSettingId) || null : null;
            userData.tennisSettings = child.tennisSettingId ? settingsMaps.tennisSettingsMap.get(child.tennisSettingId) || null : null;
            userData.matkaSettings = child.matkaSettingId ? settingsMaps.matkaSettingsMap.get(child.matkaSettingId) || null : null;
            userData.casinoSettings = child.casinoSettingId ? settingsMaps.casinoSettingsMap.get(child.casinoSettingId) || null : null;
            userData.internationalCasinoSettings = child.internationalCasinoSettingId ? settingsMaps.internationalCasinoSettingsMap.get(child.internationalCasinoSettingId) || null : null;
          }

          allUsers.push(userData);
        }
      } catch (error) {
        console.error(`Error fetching users from ${type} table:`, error);
        // Continue with other tables even if one fails
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit),
        },
        users: allUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching downline users:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const setExposureLimitForDownline = async (
  req: Request,
  res: Response
) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const uplineId = req.user?.userId;
    const uplineTransactionPassword = req.user?.transactionPassword;

    const { userId, userType, newLimit, transactionPassword } = req.body;

    if (!userId || !userType || !newLimit || !transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const userRepository = queryRunner.manager.getRepository(
      USER_TABLES[userType]
    );
    if (!userRepository) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Invalid userType provided",
      });
    }

    const user = await userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (uplineTransactionPassword !== transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: "Invalid transaction password",
      });
    }

    user.exposureLimit = newLimit;
    await userRepository.save(user);

    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Exposure limit updated successfully",
      data: user,
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  } finally {
    await queryRunner.release();
  }
};

export const changePasswordOfDownline = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const uplineTransactionPassword = req.user?.transactionPassword;

    const { userId, userType, newPassword, transactionPassword } = req.body;

    if (!userId || !userType || !newPassword || !transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const userRepository = queryRunner.manager.getRepository(
      USER_TABLES[userType]
    );
    if (!userRepository) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Invalid userType provided",
      });
    }

    const user = await userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (uplineTransactionPassword !== transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: "Invalid transaction password",
      });
    }

    user.user_password = newPassword;
    await userRepository.save(user);

    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
      data: user,
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  } finally {
    await queryRunner.release();
  }
};

export const setCreditRefForDownline = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const uplineId = req.user?.userId;
    const uplineTransactionPassword = req.user?.transactionPassword;

    const { userId, userType, newCreditRef, transactionPassword } = req.body;

    if (!userId || !userType || !newCreditRef || !transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const userRepository = queryRunner.manager.getRepository(
      USER_TABLES[userType]
    );
    if (!userRepository) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: "Invalid userType provided",
      });
    }

    const user = await userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    if (uplineTransactionPassword !== transactionPassword) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        success: false,
        error: "Invalid transaction password",
      });
    }

    if (user.creditRef == newCreditRef) {
    } else if (user.creditRef < newCreditRef) {
      const diff = newCreditRef - user.creditRef;
      user.uplineSettlement -= diff;
    } else {
      const diff = user.creditRef - newCreditRef;
      user.uplineSettlement += diff;
    }

    user.creditRef = newCreditRef;
    await userRepository.save(user);

    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: "Exposure limit updated successfully",
      data: user,
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    return res.status(500).json({
      success: false,
      error: error.message || "Something went wrong",
    });
  } finally {
    await queryRunner.release();
  }
};

export const getSportsAndCasinoSetting = async (
  req: Request,
  res: Response
) => {
  try {
    const userRepository = AppDataSource.getRepository(
      USER_TABLES[req.user?.__type]
    );

    const user = await userRepository.findOne({
      where: { id: req.user?.userId },
      relations: [
        "soccerSettings",
        "cricketSettings",
        "tennisSettings",
        "matkaSettings",
        "casinoSettings",
        "internationalCasinoSettings",
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: false, message: "No user found for given whitelist" });
    }

    const settings = {
      soccerSettings: user.soccerSettings,
      cricketSettings: user.cricketSettings,
      tennisSettings: user.tennisSettings,
      matkaSettings: user.matkaSettings,
      casinoSettings: user.casinoSettings,
      internationalCasinoSettings: user.internationalCasinoSettings,
    };

    return res.status(200).json({
      status: true,
      data: settings,
    });
  } catch (error) {
    console.error("Error fetching Soccer and Casino settings:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", error });
  }
};

export const getOwnBalance = async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(
      USER_TABLES[req.user?.__type]
    );

    const user = await userRepository.findOne({
      where: { id: req.user?.userId },
    });

    if (!user) {
      return res.status(404).json({ status: false, message: "No user found" });
    }

    return res.status(200).json({
      status: true,
      balance: user.balance,
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", error });
  }
};

export const getOwnExposure = async (req: Request, res: Response) => {
  try {
    const userRepository = AppDataSource.getRepository(
      USER_TABLES[req.user?.__type]
    );

    const user = await userRepository.findOne({
      where: { id: req.user?.userId },
    });

    if (!user) {
      return res.status(404).json({ status: false, message: "No user found" });
    }

    return res.status(200).json({
      status: true,
      exposure: user.exposure,
    });
  } catch (error) {
    console.error("Error fetching exposure:", error);
    return res
      .status(500)
      .json({ status: false, message: "Internal server error", error });
  }
};

// export const getOwnB = async (req: Request, res: Response) => {
//     try {
//         const userRepository = AppDataSource.getRepository(USER_TABLES[req.user?.__type]);

//         const user = await userRepository.findOne({
//             where: { id: req.user?.userId }
//         });

//         if (!user) {
//             return res.status(404).json({ status: false, message: "No user found" });
//         }

//         return res.status(200).json({
//             status: true,
//             balance: user.balance
//         });
//     } catch (error) {
//         console.error("Error fetching balance:", error);
//         return res.status(500).json({ status: false, message: "Internal server error", error });
//     }
// };

// export const getAccountTransactions = async (req: Request, res: Response) => {
//     try {
//         const accountTxRepo = AppDataSource.getRepository(AccountTrasaction);

//         const userId = req.user?.userId; // assuming middleware sets req.user
//         if (!userId) {
//             return res.status(401).json({
//                 status: false,
//                 message: "Unauthorized",
//             });
//         }

//         const {
//             startDate,
//             endDate,
//             type = "all",
//             page = 1,
//             limit = 10,
//         } = req.query as {
//             startDate?: string;
//             endDate?: string;
//             type?: "all" | "deposit" | "withdraw";
//             page?: string;
//             limit?: string;
//         };

//         const qb = accountTxRepo
//             .createQueryBuilder("tx")
//             .where("tx.downlineUserId = :userId", { userId });

//         // Filter by date range
//         if (startDate && endDate) {
//             qb.andWhere("tx.createdAt BETWEEN :start AND :end", {
//                 start: new Date(startDate),
//                 end: new Date(endDate),
//             });
//         } else if (startDate) {
//             qb.andWhere("tx.createdAt >= :start", { start: new Date(startDate) });
//         } else if (endDate) {
//             qb.andWhere("tx.createdAt <= :end", { end: new Date(endDate) });
//         }

//         // Filter by type
//         if (type !== "all") {
//             qb.andWhere("tx.type = :type", { type });
//         }

//         // Pagination
//         const skip = (Number(page) - 1) * Number(limit);
//         qb.skip(skip).take(Number(limit));
//         qb.orderBy("tx.createdAt", "DESC");

//         const [transactions, total] = await qb.getManyAndCount();

//         const transformed = transactions.map((tx, index) => ({
//             sNo: skip + index + 1,
//             date: format(new Date(tx.createdAt), "dd-MM-yyyy HH:mm:ss"),
//             credit: tx.type === "deposit" ? tx.amount : 0,
//             debit: tx.type === "withdraw" ? tx.amount : 0,
//             remarks: tx.remarks,
//         }));
//         return res.status(200).json({
//             status: true,
//             message: "Transactions fetched successfully",
//             data: transformed,
//             pagination: {
//                 page: Number(page),
//                 limit: Number(limit),
//                 total,
//                 totalPages: Math.ceil(total / Number(limit)),
//             },
//         });
//     } catch (error: any) {
//         console.error("Error fetching transactions:", error);
//         return res.status(500).json({
//             status: false,
//             message: "Internal server error",
//             error: process.env.NODE_ENV === "development" ? error.message : undefined,
//         });
//     }
// };

export const getAccountTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
    }

    // Get query parameters
    // Supported type values:
    // - 'all' or undefined: All transactions
    // - 'deposit-withdraw': Deposit and withdrawal transactions
    // - 'sport-report': Sports betting transactions
    // - 'casino-report': Casino betting transactions
    // - Individual types: 'deposit', 'withdraw', 'place-bet', 'settle-bet', 'payment-gateway-deposit'
    const { 
      page = 1, 
      limit = 10, 
      type, 
      startDate, 
      endDate,
      search 
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where conditions
    const whereConditions: any = {
      downlineUserId: userId
    };

    // Add type filter if provided
    if (type && type !== 'all') {
      whereConditions.type = type;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      whereConditions.createdAt = {};
      if (startDate) {
        whereConditions.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereConditions.createdAt.lte = new Date(endDate as string);
      }
    }

    // Get account transactions repository
    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);

    // Build query with pagination
    const queryBuilder = accountTransactionRepo.createQueryBuilder('transaction')
      .where('transaction.downlineUserId = :userId', { userId })
      .orderBy('transaction.createdAt', 'DESC')
      .skip(offset)
      .take(limitNum);

    // Add type filter if provided
    if (type && type !== 'all') {
      if (type === 'deposit-withdraw') {
        // Filter for deposit and withdrawal transactions
        queryBuilder.andWhere('transaction.type IN (:...types)', { 
          types: ['deposit', 'withdraw', 'payment-gateway-deposit'] 
        });
      } else if (type === 'sports') {
        // Filter for sports betting transactions
        queryBuilder.andWhere('transaction.remarks ILIKE :sportKeyword', { 
          sportKeyword: '%SPORTS%' 
        });
      } else if (type === 'casinos') {
        // Filter for casino betting transactions
        queryBuilder.andWhere('transaction.remarks ILIKE :casinoKeyword', { 
          casinoKeyword: '%CASINO%' 
        });
      } else {
        // Single type filter
        queryBuilder.andWhere('transaction.type = :type', { type });
      }
    }

    // Add date range filter
    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', { 
        startDate: new Date(startDate as string) 
      });
    }
    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { 
        endDate: new Date(endDate as string) 
      });
    }

    // Add search filter for remarks
    if (search) {
      queryBuilder.andWhere('transaction.remarks ILIKE :search', { 
        search: `%${search}%` 
      });
    }

    // Execute query
    const [transactions, totalCount] = await queryBuilder.getManyAndCount();

    // Format transactions for response
    const formattedTransactions = transactions.map((transaction: any, index: number) => ({
      srNo: offset + index + 1,
      id: transaction.id,
      date: transaction.createdAt.toISOString().split('T')[0],
      time: transaction.createdAt.toTimeString().split(' ')[0],
      type: transaction.type,
      amount: transaction.amount,
      balanceBefore: transaction.balanceBefore || 0,
      balanceAfter: transaction.balanceAfter || 0,
      remarks: transaction.remarks,
      uplineUserId: transaction.uplineUserId,
      groupId: transaction.groupId
    }));

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json({
      status: true,
      message: "Transactions fetched successfully",
      data: {
        transactions: formattedTransactions,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalRecords: totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage
        },
        summary: {
          totalTransactions: totalCount,
          totalDeposits: transactions
            .filter((t: any) => t.type === 'deposit' || t.type === 'payment-gateway-deposit')
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          totalWithdrawals: transactions
            .filter((t: any) => t.type === 'withdraw')
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          totalBets: transactions
            .filter((t: any) => t.type === 'place-bet')
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          totalSettlements: transactions
            .filter((t: any) => t.type === 'settle-bet')
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          // Report-specific summaries
          sportBets: transactions
            .filter((t: any) => t.remarks && t.remarks.includes('SPORTS'))
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          casinoBets: transactions
            .filter((t: any) => t.remarks && t.remarks.includes('CASINO'))
            .reduce((sum: number, t: any) => sum + t.amount, 0),
          depositWithdrawTotal: transactions
            .filter((t: any) => ['deposit', 'withdraw', 'payment-gateway-deposit'].includes(t.type))
            .reduce((sum: number, t: any) => sum + t.amount, 0)
        }
      }
    });
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

