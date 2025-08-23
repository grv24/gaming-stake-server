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

    const { matchId, casinoType, amount, data, exposure, commission, partnership } = req.body;

    if (!userId || !casinoType || !amount) {
      return res.status(400).json({
        status: false,
        message: "Missing required fields: userId, casinoType, and amount are required"
      });
    }

    if (!CASINO_TYPES.includes(casinoType)) {
      return res.status(400).json({
        status: false,
        message: "Invalid casino type"
      });
    }

    if (amount > userBalance - userExposure) {
      return res.status(400).json({
        status: false,
        message: "exceeded exposure limit"
      });
    }

    if (amount + userExposure > userExposureLimit) {
      return res.status(400).json({
        status: false,
        message: "exceeded exposure limit"
      });
    }

    const bet = casinoBetRepository.create({
      userId,
      userType: req.__type,
      casinoType,
      amount,
      exposure,
      commission,
      partnership,
      data,
      matchId: matchId || null,
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