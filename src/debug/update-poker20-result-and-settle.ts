#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Update Poker20 Result and Settle
 * 
 * Purpose: Update casino_match_new with fetched result and trigger settlement
 */

import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

// Import entities
import { CasinoBet } from "../entities/casino/CasinoBet";
import { CasinoMatchNew } from "../entities/casino/CasinoMatchNew";

// Load environment variables
dotenv.config();

// Database configuration
const dataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  username: process.env.POSTGRES_USERNAME || "postgres",
  password: process.env.POSTGRES_PASSWORD || "password",
  database: process.env.POSTGRES_DATABASE || "game_stake",
  entities: [
    CasinoBet,
    CasinoMatchNew
  ],
  synchronize: false,
  logging: false,
});

async function updateResultAndSettle() {
  try {
    console.log("🔍 Updating Poker20 result and settling bets...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    const casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
    
    // The result data from the API
    const matchId = '109250919071557';
    const resultData = {
      "mid": "109250919071557",
      "sid": "2",
      "win": "2",
      "cards": "4CC,QHH,KDD,8SS,9HH,2SS,10HH,8HH,7CC",
      "cardsorg": "4CC,QSS,KHH,8DD,9SS,2DD,10SS,8SS,7CC",
      "desc": "Player B || A : -  |  B : One Pair",
      "newdesc": "Player B#A : -  |  B : One Pair",
      "ename": "20-20 Poker",
      "winnat": "Player B",
      "mtime": "9/19/2025 7:15:57 AM",
      "gtype": "poker20"
    };
    
    console.log(`\n📊 Updating result for match ${matchId}:`);
    console.log(`Winner: ${resultData.winnat} (SID: ${resultData.sid})`);
    console.log(`Description: ${resultData.desc}`);
    
    // Find the match record
    const matchRecord = await casinoMatchRepo.findOne({
      where: { mid: matchId }
    });
    
    if (!matchRecord) {
      console.log(`❌ No match record found for ${matchId}`);
      return;
    }
    
    console.log(`✅ Found match record: ${matchRecord.casinoType}`);
    
    // Update the result
    matchRecord.result = resultData;
    await casinoMatchRepo.save(matchRecord);
    
    console.log(`✅ Updated match result in database`);
    
    // Now trigger settlement
    console.log(`\n🎯 Triggering settlement for match ${matchId}...`);
    
    const { getCasinoSettlementService } = await import("../services/casino/CasinoSettlementService");
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    const settlementResult = await casinoSettlementService.settleCasinoMatch('poker20', matchId);
    
    console.log(`\n📊 Settlement Result:`, {
      success: settlementResult.success,
      message: settlementResult.message,
      settledBets: settlementResult.settledBets,
      totalProfitLoss: settlementResult.totalProfitLoss
    });
    
    if (settlementResult.success) {
      console.log(`\n✅ Settlement completed successfully!`);
      console.log(`📈 Settled ${settlementResult.settledBets} bets`);
      console.log(`💰 Total P&L: ₹${settlementResult.totalProfitLoss}`);
    } else {
      console.log(`\n❌ Settlement failed: ${settlementResult.message}`);
    }
    
  } catch (error: any) {
    console.error("❌ Error updating result and settling:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    // Close database connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the update and settlement
updateResultAndSettle().then(() => {
  console.log("\n✅ Update and settlement completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
