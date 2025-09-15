import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { SportSettlementService } from "../../services/sports/SportSettlementService";

/**
 * MANUAL SPORT SETTLEMENT TEST ENDPOINT
 * 
 * Purpose: Test sport settlement service manually
 * Usage: POST /api/test/sport-settlement
 * Body: { "eventIds": ["593847199", "469103148", "652266196"] }
 */
export const testSportSettlement = async (req: Request, res: Response) => {
  try {
    const { eventIds } = req.body;
    
    if (!eventIds || !Array.isArray(eventIds)) {
      return res.status(400).json({
        success: false,
        message: "eventIds array is required in request body"
      });
    }

    console.log(`[TEST] Manual sport settlement test for ${eventIds.length} events:`, eventIds);

    // Check database connection
    if (!AppDataSource.isInitialized) {
      return res.status(500).json({
        success: false,
        message: "Database not initialized"
      });
    }

    // Create sport settlement service
    const sportSettlementService = new SportSettlementService(AppDataSource);

    // Run batch settlement
    const result = await sportSettlementService.batchSettleMatches(eventIds);

    console.log(`[TEST] Sport settlement test completed:`, result);

    return res.status(200).json({
      success: true,
      message: "Sport settlement test completed",
      data: {
        eventIds,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error("[TEST] Sport settlement test failed:", error);
    return res.status(500).json({
      success: false,
      message: "Sport settlement test failed",
      error: error.message
    });
  }
};
