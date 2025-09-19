#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Check Pending Casino Bets
 * 
 * Purpose: Check and display all pending casino bets for debugging
 * 
 * Usage:
 * - Check all pending bets: npm run debug:casino-bets
 * - Check specific match: npm run debug:casino-bets -- --matchId=12345
 * - Check specific casino type: npm run debug:casino-bets -- --casinoType=baccarat2
 */

import { DataSource } from "typeorm";
import { getCasinoSettlementService } from "../services/casino/CasinoSettlementService";
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

async function checkPendingCasinoBets() {
  try {
    console.log("🔍 Starting casino bets check...");
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    let matchId: string | undefined;
    let casinoType: string | undefined;
    
    args.forEach(arg => {
      if (arg.startsWith('--matchId=')) {
        matchId = arg.split('=')[1];
      } else if (arg.startsWith('--casinoType=')) {
        casinoType = arg.split('=')[1];
      }
    });
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    // Get casino settlement service
    const casinoSettlementService = getCasinoSettlementService(dataSource);
    
    // Check pending bets
    console.log(`\n📊 Checking pending casino bets${matchId ? ` for match ${matchId}` : casinoType ? ` for casino type ${casinoType}` : ''}...`);
    
    const result = await casinoSettlementService.checkPendingCasinoBets(matchId, casinoType);
    
    console.log("\n📋 RESULTS:");
    console.log("=".repeat(50));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📈 Total Pending Bets: ${result.totalPendingBets}`);
    console.log(`📊 Total Pending Bets (All): ${result.totalPendingBetsAll}`);
    console.log(`🎯 Matches with Pending Bets: ${result.betsByMatch.length}`);
    
    if (result.betsByMatch.length > 0) {
      console.log("\n🎮 MATCHES WITH PENDING BETS:");
      console.log("-".repeat(50));
      
      result.betsByMatch.forEach((match: any, index: number) => {
        console.log(`\n${index + 1}. Match ID: ${match.matchId}`);
        console.log(`   📊 Bet Count: ${match.betCount}`);
        console.log(`   🎯 Casino Types: ${match.casinoTypes.join(', ')}`);
        console.log(`   👥 Users: ${match.users.length} unique users`);
        console.log(`   👤 User IDs: ${match.users.join(', ')}`);
      });
    } else {
      console.log("\n🎉 No pending casino bets found!");
    }
    
    console.log(`\n⏰ Check completed at: ${result.timestamp}`);
    
  } catch (error: any) {
    console.error("❌ Error checking pending casino bets:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    // Close database connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the check
checkPendingCasinoBets().then(() => {
  console.log("\n✅ Casino bets check completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
