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

export const casinoResult = async (req: Request, res: Response) => {
  try {
    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);

    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        status: false,
        message: "Unauthorized",
      });
    }

    const {
      startTime,
      endTime,
      slugName,
      search,
      page = 1,
      limit = 10,
    } = req.query as {
      startTime?: string;
      endTime?: string;
      slugName?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const qb = casinoBetRepo
      .createQueryBuilder("bet")
      .where("bet.userId = :userId", { userId });

    if (startTime && endTime) {
      qb.andWhere("bet.createdAt BETWEEN :start AND :end", {
        start: new Date(startTime),
        end: new Date(endTime),
      });
    } else if (startTime) {
      qb.andWhere("bet.createdAt >= :start", { start: new Date(startTime) });
    } else if (endTime) {
      qb.andWhere("bet.createdAt <= :end", { end: new Date(endTime) });
    }

    if (slugName) {
      qb.andWhere("bet.betData ->> 'slugName' ILIKE :slugName", {
        slugName: `%${slugName}%`,
      });
    }

    if (search) {
      qb.andWhere(
        `(bet.betData ->> 'slugName' ILIKE :search 
          OR bet.betData -> 'result' ->> 'status' ILIKE :search
          OR bet.matchId ILIKE :search)`,
        { search: `%${search}%` }
      );
    }

    const skip = (Number(page) - 1) * Number(limit);
    qb.skip(skip).take(Number(limit));
    qb.orderBy("bet.createdAt", "DESC");

    const [bets, total] = await qb.getManyAndCount();

    // ✅ transform result: pick only required fields if result exists
    const transformed = bets
      .filter((bet) => bet.betData?.result) // only include those with result
      .map((bet) => {
        return {
          id: bet.id,
          matchId: bet.matchId,
          createdAt: bet.createdAt,
          updatedAt: bet.updatedAt,
          status: bet.status,
          gameDate: bet.betData?.gameDate,
          gameName: bet.betData?.gameName,
          stake: bet.betData?.stake,
          winner: bet.betData?.result?.winner,
          resultStatus: bet.betData?.result?.status,
        };
      });

    return res.status(200).json({
      status: true,
      message: "User bets fetched successfully",
      data: transformed,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching bets:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};