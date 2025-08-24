import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../Helpers/Request/Validation";
import { USER_TABLES } from "../../Helpers/users/Roles";

export const createBet = async (req: Request, res: Response) => {
  const casinoBetRepository = AppDataSource.getRepository(CasinoBet);

  try {

    const userId = req.user.userId;
    
    const { betData, exposure, commission, partnership } = req.body;
    
    const userRepo = AppDataSource.getRepository(USER_TABLES[req.__type!]);
    
    const user = await userRepo.findOne({ where: { id: userId } });

    if (!user) {
      return res.status(401).json({
        status: false,
        message: "User not found"
      });
    }

    const userBalance = Number(user.balance);
    const userExposure = Number(user.exposure);
    const userExposureLimit = Number(user.exposureLimit);
    const stakeAmount = Number(betData?.stake);

    if (!userId || !stakeAmount) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, casinoType, and amount are required"
      });
    }

    if (stakeAmount > userBalance - userExposure) {
      return res.status(400).json({
        status: false,
        message: "Not enough balance"
      });
    }

    if (stakeAmount + userExposure > userExposureLimit) {
      return res.status(400).json({
        status: false,
        message: "exceeded exposure limit"
      });
    }

    const bet = casinoBetRepository.create({
      userId,
      userType: req.__type,
      exposure,
      commission,
      partnership,
      betData,
      matchId: betData?.mid || null,
      status: "pending",
    });

    await casinoBetRepository.save(bet);

    user.exposure = userExposure + stakeAmount;

    await userRepo.save(user);

    return res.status(201).json({
      status: true,
      message: "Bet placed successfully",
      data: bet,
    });

  } catch (error: any) {
    console.error("Error placing bet:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};