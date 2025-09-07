import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { SportBet } from "../../entities/sports/SportBet";
import { Client } from "../../entities/users/ClientUser";
import { In } from "typeorm";

export const getDownlineBets = async (req: Request, res: Response) => {
  try {
    const myUserId = req.user?.userId; 

    if (!myUserId) {
      return res.status(400).json({ success: false, message: "User ID missing" });
    }

    const userRepo = AppDataSource.getRepository(Client);
    const betRepo = AppDataSource.getRepository(SportBet);

    // 1. Find all users whose uplineId = myUserId
    const downlineUsers = await userRepo.find({
      where: { uplineId: myUserId },
      select: ["id"], 
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

    return res.json({success: true, message: "bet updated", bets });
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
