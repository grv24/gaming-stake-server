#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Check Poker20 Match Results
 * 
 * Purpose: Check if result data is available for the new Poker20 matches
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

async function checkPoker20Results() {
  try {
    console.log("🔍 Checking Poker20 match results...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }
    
    const casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
    
    // The new Poker20 match IDs
    const matchIds = [
      '109250919071557',
      '109250919071031'
    ];
    
    console.log(`\n📊 Checking results for ${matchIds.length} Poker20 matches...`);
    
    for (const matchId of matchIds) {
      console.log(`\n🎯 Checking Match ID: ${matchId}`);
      
      // Check if there's a result for this match
      const matchResult = await casinoMatchRepo.findOne({
        where: { mid: matchId }
      });
      
      if (matchResult) {
        console.log(`✅ Match result found:`);
        console.log(`   Casino Type: ${matchResult.casinoType}`);
        console.log(`   Result Data: ${JSON.stringify(matchResult.result, null, 2)}`);
        console.log(`   Created: ${matchResult.createdAt}`);
        console.log(`   Updated: ${matchResult.updatedAt}`);
      } else {
        console.log(`❌ No match result found for ${matchId}`);
      }
    }
    
    // Also check for any poker20 matches with results
    console.log(`\n🔍 Checking all poker20 matches with results...`);
    const poker20Matches = await casinoMatchRepo.find({
      where: { casinoType: 'poker20' },
      order: { createdAt: 'DESC' },
      take: 10
    });
    
    console.log(`Found ${poker20Matches.length} poker20 matches with results:`);
    poker20Matches.forEach((match, index) => {
      console.log(`\n${index + 1}. Match ID: ${match.mid}`);
      console.log(`   Casino Type: ${match.casinoType}`);
      console.log(`   Has Result: ${match.result ? 'Yes' : 'No'}`);
      if (match.result) {
        console.log(`   Result: ${JSON.stringify(match.result, null, 2)}`);
      }
      console.log(`   Created: ${match.createdAt}`);
    });
    
  } catch (error: any) {
    console.error("❌ Error checking Poker20 results:", error.message);
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
checkPoker20Results().then(() => {
  console.log("\n✅ Poker20 results check completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});




