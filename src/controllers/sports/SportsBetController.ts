import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { SportBet } from "../../entities/sports/SportBet";

export const createBet = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const userId = req.user.userId;
    const { betData, exposure, commission, partnership } = req.body;

    // Validate required fields
    if (!userId || !betData || !betData?.stake || !betData?.mid || !betData?.gameSlug) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, betData with stake, mid, and gameSlug are required"
      });
    }

    const userRepo = queryRunner.manager.getRepository(USER_TABLES[req.__type!]);
    const sportsBetRepository = queryRunner.manager.getRepository(SportBet);

    // Get user with lock to prevent race conditions
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: "pessimistic_write" }
    });

    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Check if user is allowed to bet
    if (user.userLocked || user.bettingLocked) {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        status: false,
        message: "User account is locked from betting"
      });
    }

    const userBalance = Number(user.balance);
    const userExposure = Number(user.exposure);
    const userExposureLimit = Number(user.exposureLimit);
    const stakeAmount = Number(betData.stake);

    // Validate stake amount
    if (stakeAmount <= 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Stake amount must be greater than 0"
      });
    }

    // Check available balance (balance minus current exposure)
    const availableBalance = userBalance - userExposure;
    if (stakeAmount > availableBalance) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Not enough available balance"
      });
    }

    // Check exposure limit (current exposure + new stake)
    if (userExposure + stakeAmount > userExposureLimit) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        status: false,
        message: "Exceeds exposure limit"
      });
    }

    // Create and save bet
    const bet = sportsBetRepository.create({
      userId,
      userType: req.__type,
      exposure: exposure || 0,
      commission: commission || 0,
      partnership: partnership || 0,
      betData: {
        ...betData,
        stake: stakeAmount,
        placedAt: new Date().toISOString()
      },
      matchId: betData.mid,
      status: "pending",
    });

    await sportsBetRepository.save(bet);

    // Update user exposure
    user.exposure = userExposure + stakeAmount;
    await userRepo.save(user);

    await queryRunner.commitTransaction();

    return res.status(201).json({
      status: true,
      message: "Bet placed successfully",
      data: bet,
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error("Error placing bet:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};