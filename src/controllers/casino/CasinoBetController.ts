import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../Helpers/Request/Validation";

export const createBet = async (req: Request, res: Response) => {
    
    const casinoBetRepository = AppDataSource.getRepository(CasinoBet);
    
    try {
    const { userId, matchId, casinoType, amount, data } = req.body;

    if (!userId || !casinoType || !amount) {
      return res.status(400).json({ status: false, message: "Missing required fields" });
    }

    if (!CASINO_TYPES.includes(casinoType)) {
      return res.status(400).json({ status: false, message: "Invalid casino type" });
    }

    const bet = casinoBetRepository.create({
      userId,
      casinoType,
      amount,
      data,
      matchId,
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
    return res.status(500).json({ status: false, message: "Internal server error" });
  }
};
