import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { SportBet } from "../../entities/sports/SportBet";
import { Client } from "../../entities/users/ClientUser";
import { AccountTrasaction } from "../../entities/Transactions/AccountTransactions";
import { In } from "typeorm";

export const getDownlineBets = async (req: Request, res: Response) => {
  try {
    const myUserId = req.user?.userId; 

    if (!myUserId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    const userRepo = AppDataSource.getRepository(Client);
    const betRepo = AppDataSource.getRepository(SportBet);

    // 1. Find all users whose uplineId = myUserId with their details
    const downlineUsers = await userRepo.find({
      where: { uplineId: myUserId },
      select: [
        "id", 
        "userName", 
        "loginId", 
        "mobile", 
        "balance", 
        "exposure", 
        "isActive", 
        "createdAt"
      ], 
    });

    const downlineUserIds = downlineUsers.map((u) => u.id);

    if (downlineUserIds.length === 0) {
      return res.json({ success: true, bets: [] });
    }

    // 2. Fetch bets placed by these users
    const bets = await betRepo.find({
      where: { userId: In(downlineUserIds) },
      order: { createdAt: "DESC" },
    });

    // 3. Create a map of user details for quick lookup
    const userDetailsMap = new Map();
    downlineUsers.forEach(user => {
      userDetailsMap.set(user.id, {
        id: user.id,
        userName: user.userName,
        loginId: user.loginId,
        mobile: user.mobile,
        balance: user.balance,
        exposure: user.exposure,
        isActive: user.isActive,
        createdAt: user.createdAt
      });
    });

    // 4. Combine bets with user details
    const betsWithUserDetails = bets.map(bet => ({
      ...bet,
      userDetails: userDetailsMap.get(bet.userId) || null
    }));

    return res.json({
      success: true, 
      message: "Downline bets retrieved successfully", 
      bets: betsWithUserDetails,
      totalBets: betsWithUserDetails.length,
      totalDownlineUsers: downlineUsers.length
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const updateBet = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const betRepo = AppDataSource.getRepository(SportBet);
    const clientRepo = AppDataSource.getRepository(Client);

    const bet = await betRepo.findOne({ where: { id } });
    if (!bet) {
      return res.status(404).json({ success: false, message: "Bet not found" });
    }

    const client = await clientRepo.findOne({ where: { id: bet.userId as any } });
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const oldStatus = bet.status;
    const newStatus = updates.status || oldStatus;

    if (updates.betData) {
      bet.betData = {
        ...(bet.betData || {}),
        ...updates.betData,
      };
      delete updates.betData;
    }

    const { stake = 0, profit = 0, loss } = bet.betData || {};

    // Handle status transitions
    if (oldStatus !== newStatus) {
      if (oldStatus === "pending" && newStatus === "won") {
        client.balance += Number(profit);
        client.exposure -= stake;
      } else if (oldStatus === "pending" && newStatus === "lost") {
        client.balance -= Number(stake);
        client.exposure -= Number(stake);
      } else if (oldStatus === "won" && newStatus === "lost") {
        client.balance -= Number(profit);
        client.balance -= Number(loss);
      } else if (oldStatus === "lost" && newStatus === "won") {
        client.balance += Number(loss);
        client.balance += Number(profit);
      }
    }

    // Merge other updates
    Object.assign(bet, updates);

    // Create account transaction if status changed
    if (oldStatus !== newStatus) {
      const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
      const accountTransaction = accountTransactionRepo.create({
        uplineUserId: client.uplineId || client.id,
        downlineUserId: client.id,
        remarks: `[MANUAL-BET-UPDATE] Bet ${bet.id} status changed from ${oldStatus} to ${newStatus} - Stake: ${stake}, P/L: ${profit}`,
        type: newStatus === "won" ? "deposit" : "withdraw",
        amount: newStatus === "won" ? Number(profit) : Number(stake),
        createdAt: new Date()
      });
      await accountTransactionRepo.save(accountTransaction);
    }

    await betRepo.save(bet);
    await clientRepo.save(client);

    return res.json({
      success: true,
      message: "Bet and client updated",
      data: { bet, client },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reopenBet = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const betRepo = AppDataSource.getRepository(SportBet);
    const clientRepo = AppDataSource.getRepository(Client);

    const bet = await betRepo.findOne({ where: { id } });
    if (!bet) {
      return res.status(404).json({ success: false, message: "Bet not found" });
    }

    const client = await clientRepo.findOne({ where: { id: bet.userId as any } });
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const oldStatus = bet.status;
    const { stake = 0, profit = 0, loss = 0 } = bet.betData || {};

    if (oldStatus === "won") {
      client.balance -= Number(profit);
      client.exposure += Number(stake);
    } else if (oldStatus === "lost") {
      client.balance += Number(loss);
      client.exposure += Number(stake);
    }

    bet.status = "pending";

    // Create account transaction for bet reopening
    const accountTransactionRepo = AppDataSource.getRepository(AccountTrasaction);
    const accountTransaction = accountTransactionRepo.create({
      uplineUserId: client.uplineId || client.id,
      downlineUserId: client.id,
      remarks: `[BET-REOPENED] Bet ${bet.id} reopened from ${oldStatus} to pending - Stake: ${stake}, Previous P/L: ${profit}`,
      type: oldStatus === "won" ? "withdraw" : "deposit",
      amount: oldStatus === "won" ? Number(profit) : Number(loss),
      createdAt: new Date()
    });
    await accountTransactionRepo.save(accountTransaction);

    await betRepo.save(bet);
    await clientRepo.save(client);

    return res.json({
      success: true,
      message: "Bet reopened successfully",
      data: { bet, client },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// --------------------------- ISKO IGNORE KAROOO -------------------------------------------------------

// export const deleteBet = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const betRepo = AppDataSource.getRepository(SportBet);
//     const clientRepo = AppDataSource.getRepository(Client);

//     const bet = await betRepo.findOne({ where: { id } });
//     if (!bet) {
//       return res.status(404).json({ success: false, message: "Bet not found" });
//     }

//     const client = await clientRepo.findOne({ where: { id: bet.userId as any } });
//     if (!client) {
//       return res.status(404).json({ success: false, message: "Client not found" });
//     }

//     const oldStatus = bet.status;
//     const { stake = 0, profit = 0, loss = 0 } = bet.betData || {};

//     // Rollback logic same as reopen
//     if (oldStatus === "won") {
//       client.balance -= Number(profit);
//       client.exposure += Number(stake);
//     } else if (oldStatus === "lost") {
//       client.balance += Number(loss);
//       client.exposure += Number(stake);
//     }

//     bet.status = "pending";
//     bet.isActive = false; 

//     await betRepo.save(bet);
//     await clientRepo.save(client);

//     return res.json({
//       success: true,
//       message: "Bet deleted successfully",
//       data: { bet, client },
//     });
//   } catch (error: any) {
//     console.error(error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };
