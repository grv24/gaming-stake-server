import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { CasinoBet } from "../../entities/casino/CasinoBet";
import { CASINO_TYPES } from "../../Helpers/Request/Validation";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { getRedisPublisher } from "../../config/redisPubSub";

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

    const userRepo = AppDataSource.getRepository(USER_TABLES[req.__type!]);
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({
        status: false,
        message: "User not found"
      });
    }
    user.exposure = Number(user.exposure) + Number(betData?.stake);
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

// Manual trigger for testing casino events
export const triggerCasinoEvent = async (req: Request, res: Response) => {
  try {
    const { casinoType = 'dt6' } = req.body;

    const redisPublisher = getRedisPublisher();

    const testData = {
      casinoType,
      current: {
        mid: `manual_${casinoType}_${Date.now()}`,
        status: 'live',
        data: {
          manual: true,
          timestamp: Date.now()
        }
      },
      results: [
        {
          mid: `manual_result_${casinoType}_1`,
          win: 'A',
          timestamp: Date.now()
        }
      ]
    };

    const channel = `casino_odds_updates:${casinoType}`;
    const message = JSON.stringify(testData);

    console.log(`📤 [MANUAL] Publishing to channel: ${channel}`);
    console.log(`📄 [MANUAL] Message: ${message}`);

    await redisPublisher.publish(channel, message);
    console.log(`✅ [MANUAL] Successfully published to ${channel}`);

    res.json({
      success: true,
      message: `Casino event triggered for ${casinoType}`,
      data: testData
    });
  } catch (error: any) {
    console.error('❌ [MANUAL] Failed to trigger casino event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger casino event',
      error: error.message
    });
  }
};

export const getCasinoBets = async (req: Request, res: Response) => {
  try {
    const casinoBetRepo = AppDataSource.getRepository(CasinoBet);
    const { mid, slug } = req.query;

    if (!mid && !slug) {
      return res.status(400).json({
        success: false,
        message: "Either mid (matchId) or slug (gameSlug) parameter is required"
      });
    }

    let queryBuilder = casinoBetRepo.createQueryBuilder("bet");

    if (mid) {
      queryBuilder = queryBuilder.where("bet.matchId = :mid", { mid });
    }

    if (slug) {
      if (mid) {
        queryBuilder = queryBuilder.andWhere("bet.betData->>'gameSlug' = :slug", { slug });
      } else {
        queryBuilder = queryBuilder.where("bet.betData->>'gameSlug' = :slug", { slug });
      }
    }

    const bets = await queryBuilder.getMany();

    res.json({
      success: true,
      data: bets,
      count: bets.length,
      filters: {
        mid: mid || null,
        slug: slug || null
      }
    });

  } catch (error) {
    console.error('Error fetching casino bets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch casino bets'
    });
  }
};