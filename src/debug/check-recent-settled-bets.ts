#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Check Recent Settled Casino Bets
 * 
 * Purpose: Check what happened to the Poker20 bets
 */

import { DataSource } from "typeorm";
import * as dotenv from "dotenv";

// Import entities
import { CasinoBet } from "../entities/casino/CasinoBet";

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
    CasinoBet
  ],
  synchronize: false,
  logging: false,
});

async function checkRecentSettledBets() {
  try {
    console.log("🔍 Checking recent settled casino bets...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    const casinoBetRepo = dataSource.getRepository(CasinoBet);
    
    // Check recent bets (last 10)
    const recentBets = await casinoBetRepo.find({
      order: { updatedAt: "DESC" },
      take: 10
    });
    
    console.log(`\n📊 Recent ${recentBets.length} casino bets:`);
    
    recentBets.forEach((bet, index) => {
      console.log(`\n${index + 1}. Bet ID: ${bet.id}`);
      console.log(`   User ID: ${bet.userId}`);
      console.log(`   Match ID: ${bet.matchId}`);
      console.log(`   Status: ${bet.status}`);
      console.log(`   Game: ${bet.betData?.gameSlug || 'unknown'}`);
      console.log(`   Bet: ${bet.betData?.name || 'unknown'} (SID: ${bet.betData?.sid})`);
      console.log(`   Stake: ₹${bet.betData?.stake}`);
      console.log(`   Profit: ₹${bet.betData?.profit}`);
      console.log(`   Created: ${bet.createdAt}`);
      console.log(`   Updated: ${bet.updatedAt}`);
      
      if (bet.betData?.result?.settled) {
        console.log(`   ✅ Settled: ${bet.betData.result.settled}`);
        console.log(`   💰 P&L: ₹${bet.betData.result.profitLoss || 0}`);
      }
    });
    
    // Specifically check the Poker20 match IDs
    const poker20MatchIds = ['109250919071557', '109250919071031'];
    
    console.log(`\n🎯 Checking specific Poker20 matches:`);
    
    for (const matchId of poker20MatchIds) {
      const bets = await casinoBetRepo.find({
        where: { matchId: matchId },
        order: { updatedAt: "DESC" }
      });
      
      console.log(`\nMatch ${matchId}:`);
      if (bets.length === 0) {
        console.log(`   ❌ No bets found`);
      } else {
        bets.forEach((bet, index) => {
          console.log(`   ${index + 1}. Bet ID: ${bet.id}`);
          console.log(`      Status: ${bet.status}`);
          console.log(`      Game: ${bet.betData?.gameSlug}`);
          console.log(`      Bet: ${bet.betData?.name} (SID: ${bet.betData?.sid})`);
          console.log(`      Stake: ₹${bet.betData?.stake}`);
          console.log(`      Updated: ${bet.updatedAt}`);
          if (bet.betData?.result?.settled) {
            console.log(`      ✅ Settled: ${bet.betData.result.settled}`);
            console.log(`      💰 P&L: ₹${bet.betData.result.profitLoss || 0}`);
          }
        });
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error checking recent settled bets:", error.message);
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
checkRecentSettledBets().then(() => {
  console.log("\n✅ Recent settled bets check completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});




