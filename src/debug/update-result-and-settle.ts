#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Update Missing Result and Settle
 * 
 * Purpose: Update the casino_match_new table with missing result and settle the bet
 */

import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

// Import entities
import { CasinoBet } from "../entities/casino/CasinoBet";
import { CasinoMatchNew } from "../entities/casino/CasinoMatchNew";
import { AccountTrasaction } from "../entities/Transactions/AccountTransactions";
import { Client } from "../entities/users/ClientUser";
import { Agent } from "../entities/users/AgentUser";
import { Master } from "../entities/users/MasterUser";
import { SuperAgent } from "../entities/users/SuperAgentUser";
import { SuperMaster } from "../entities/users/SuperMasterUser";
import { Admin } from "../entities/users/AdminUser";
import { MiniAdmin } from "../entities/users/MiniAdminUser";
import { TechAdmin } from "../entities/users/TechAdminUser";
import { Developer } from "../entities/users/DeveloperUser";
import { SoccerSettings } from "../entities/users/utils/SoccerSetting";
import { TennisSettings } from "../entities/users/utils/TennisSetting";
import { CricketSettings } from "../entities/users/utils/CricketSetting";
import { CasinoSettings } from "../entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "../entities/users/utils/InternationalCasino";
import { MatkaSettings } from "../entities/users/utils/MatkaSetting";

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
    CasinoMatchNew,
    AccountTrasaction,
    Client,
    Agent,
    Master,
    SuperAgent,
    SuperMaster,
    Admin,
    MiniAdmin,
    TechAdmin,
    Developer,
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings
  ],
  synchronize: false,
  logging: false,
});

async function updateResultAndSettle() {
  try {
    console.log("🔧 Updating missing result and settling bet...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    const casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
    const matchId = '118250919060021';
    const casinoType = 'dt6';
    
    // The result data from the API
    const resultData = {
      "mid": "118250919060021",
      "sid": "1",
      "win": "1",
      "cards": "5SS,2CC",
      "cardsorg": "5DD,2CC",
      "desc": "Dragon || No || D : Odd  |  T : Even || D : Red  |  T : Black || D : Diamond  |  T : Club",
      "newdesc": "Dragon#No#D : Odd  |  T : Even#D : Red  |  T : Black#D : Diamond  |  T : Club",
      "ename": "1 Day Dragon Tiger",
      "winnat": "Dragon",
      "mtime": "9/19/2025 6:00:21 AM",
      "gtype": "dt6"
    };
    
    console.log(`\n📊 Updating casino_match_new with result data...`);
    
    // Find existing match record
    let casinoMatch = await casinoMatchRepo.findOne({
      where: { mid: matchId, casinoType }
    });
    
    if (casinoMatch) {
      // Update existing record
      casinoMatch.result = resultData;
      await casinoMatchRepo.save(casinoMatch);
      console.log(`✅ Updated existing match record`);
    } else {
      // Create new record
      casinoMatch = casinoMatchRepo.create({
        mid: matchId,
        casinoType,
        result: resultData,
      });
      await casinoMatchRepo.save(casinoMatch);
      console.log(`✅ Created new match record`);
    }
    
    console.log(`\n🎯 Now attempting to settle the bet...`);
    
    // Get casino settlement service
    const { getCasinoSettlementService } = await import("../services/casino/CasinoSettlementService");
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    // Settle the match
    const result = await casinoSettlementService.settleCasinoMatch(casinoType, matchId);
    
    console.log(`\n✅ Settlement result:`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Message: ${result.message}`);
    console.log(`   Settled Count: ${result.settledCount}`);
    console.log(`   Error Count: ${result.errorCount || 0}`);
    
    if (result.winners) {
      console.log(`   Winners: [${result.winners.join(', ')}]`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`   Errors:`, result.errors);
    }
    
    // Check if the bet is now settled
    console.log(`\n🔍 Checking if bet is now settled...`);
    const casinoBetRepo = dataSource.getRepository(CasinoBet);
    const betId = 'fbd268f7-ff0e-493f-ad05-58156927058c';
    
    const bet = await casinoBetRepo.findOne({ where: { id: betId } });
    if (bet) {
      console.log(`\nBet ${betId}:`);
      console.log(`   Status: ${bet.status}`);
      console.log(`   Settled: ${bet.betData?.result?.settled}`);
      console.log(`   Profit/Loss: ${bet.betData?.result?.profitLoss}`);
      console.log(`   Winner: ${bet.betData?.result?.winner}`);
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

