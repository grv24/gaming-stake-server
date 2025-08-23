import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../Helpers/Request/Validation";

export const createBet = async (req: Request, res: Response) => {
  const casinoBetRepository = AppDataSource.getRepository(CasinoBet);

  try {

    const userId = req.user.userId;
    const userBalance = req.user.AccountDetails.Balance;
    const userExposure = req.user.AccountDetails.Exposure;
    const userExposureLimit = req.user.AccountDetails.ExposureLimit;

    const { betData, exposure, commission, partnership } = req.body;

    if (!userId || !betData?.stake) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, casinoType, and amount are required"
      });
    }

    if (betData?.stake > userBalance - userExposure) {
      return res.status(400).json({
        status: false,
        message: "exceeded exposure limit"
      });
    }

    if (betData?.stake + userExposure > userExposureLimit) {
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