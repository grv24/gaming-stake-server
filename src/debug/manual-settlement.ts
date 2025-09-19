#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Manual Casino Settlement
 * 
 * Purpose: Manually trigger settlement for specific casino matches
 */

import { DataSource } from "typeorm";
import { getCasinoSettlementService } from "../services/casino/CasinoSettlementService";
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

async function manualSettlement() {
  try {
    console.log("🔧 Starting manual casino settlement...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    // Get casino settlement service
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    // The matches that have results but aren't settled
    const matchesToSettle = [
      { casinoType: 'dt6', mid: '118250919060853' },
      { casinoType: 'dt6', mid: '118250919060311' }
    ];
    
    console.log(`\n🎯 Attempting to settle ${matchesToSettle.length} matches...`);
    
    for (const match of matchesToSettle) {
      console.log(`\n🎮 Settling ${match.casinoType}:${match.mid}...`);
      
      try {
        const result = await casinoSettlementService.settleCasinoMatch(match.casinoType, match.mid);
        
        console.log(`✅ Settlement result:`);
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
        
      } catch (error: any) {
        console.error(`❌ Error settling ${match.casinoType}:${match.mid}:`, error.message);
      }
    }
    
    // Check if bets are now settled
    console.log(`\n🔍 Checking if bets are now settled...`);
    const casinoBetRepo = dataSource.getRepository(CasinoBet);
    
    const betIds = [
      '48672fa2-1dbf-41cc-bbf5-086fecf527b4',
      'f443b703-cc14-4dcb-a89d-5a18a93b6a57'
    ];
    
    for (const betId of betIds) {
      const bet = await casinoBetRepo.findOne({ where: { id: betId } });
      if (bet) {
        console.log(`\nBet ${betId}:`);
        console.log(`   Status: ${bet.status}`);
        console.log(`   Settled: ${bet.betData?.result?.settled}`);
        console.log(`   Profit/Loss: ${bet.betData?.result?.profitLoss}`);
        console.log(`   Winner: ${bet.betData?.result?.winner}`);
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error in manual settlement:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    // Close database connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the manual settlement
manualSettlement().then(() => {
  console.log("\n✅ Manual settlement completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
