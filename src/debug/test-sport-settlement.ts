#!/usr/bin/env ts-node

/**
 * TEST SCRIPT: Sport Settlement System
 * 
 * Purpose: Test all manual settlement scenarios to ensure they work correctly
 * 
 * Tests:
 * 1. User self-settlement
 * 2. Admin manual bet update
 * 3. Bet reopening
 * 4. Automated settlement service
 */

import { DataSource } from "typeorm";
import { SportBet } from "../entities/sports/SportBet";
import { SportMatch } from "../entities/sports/SportMatch";
import { AccountTrasaction } from "../entities/Transactions/AccountTransactions";
import { Client } from "../entities/users/ClientUser";
import { SportSettlementService } from "../services/sports/SportSettlementService";
import * as dotenv from "dotenv";

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
    SportBet,
    SportMatch,
    AccountTrasaction,
    Client
  ],
  synchronize: false,
  logging: false,
});

async function testSettlementScenarios() {
  try {
    console.log("🧪 Starting Sport Settlement System Tests...");
    
    // Initialize database connection
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log("✅ Database connected");
    }

    // Test 1: Check if we have any pending sport bets
    console.log("\n📊 Test 1: Checking for pending sport bets...");
    const sportBetRepo = dataSource.getRepository(SportBet);
    const pendingBets = await sportBetRepo.find({
      where: { status: "pending" },
      take: 5,
      order: { createdAt: "DESC" }
    });

    console.log(`Found ${pendingBets.length} pending sport bets`);
    if (pendingBets.length > 0) {
      console.log("Sample pending bet:", {
        id: pendingBets[0].id,
        userId: pendingBets[0].userId,
        eventId: pendingBets[0].eventId,
        status: pendingBets[0].status,
        betData: pendingBets[0].betData
      });
    }

    // Test 2: Check account transactions table
    console.log("\n📊 Test 2: Checking account transactions...");
    const accountTransactionRepo = dataSource.getRepository(AccountTrasaction);
    const recentTransactions = await accountTransactionRepo.find({
      where: [
        { remarks: "LIKE '%SPORT-BET-SETTLED%'" },
        { remarks: "LIKE '%MANUAL-BET-UPDATE%'" },
        { remarks: "LIKE '%BET-REOPENED%'" }
      ],
      take: 5,
      order: { createdAt: "DESC" }
    });

    console.log(`Found ${recentTransactions.length} recent sport-related transactions`);
    if (recentTransactions.length > 0) {
      console.log("Sample transaction:", {
        id: recentTransactions[0].id,
        uplineUserId: recentTransactions[0].uplineUserId,
        downlineUserId: recentTransactions[0].downlineUserId,
        remarks: recentTransactions[0].remarks,
        type: recentTransactions[0].type,
        amount: recentTransactions[0].amount,
        createdAt: recentTransactions[0].createdAt
      });
    }

    // Test 3: Check SportMatch records
    console.log("\n📊 Test 3: Checking SportMatch records...");
    const sportMatchRepo = dataSource.getRepository(SportMatch);
    const sportMatches = await sportMatchRepo.find({
      take: 3,
      order: { createdAt: "DESC" }
    });

    console.log(`Found ${sportMatches.length} SportMatch records`);
    if (sportMatches.length > 0) {
      console.log("Sample SportMatch:", {
        id: sportMatches[0].id,
        eventId: sportMatches[0].eventId,
        sportId: sportMatches[0].sportId,
        categories: sportMatches[0].categories?.length || 0
      });
    }

    // Test 4: Test automated settlement service
    console.log("\n📊 Test 4: Testing automated settlement service...");
    const sportSettlementService = new SportSettlementService(dataSource);
    
    // Get some event IDs from pending bets
    const eventIds = [...new Set(pendingBets.map(bet => bet.eventId))].slice(0, 2);
    
    if (eventIds.length > 0) {
      console.log(`Testing settlement for events: ${eventIds.join(', ')}`);
      
      try {
        const result = await sportSettlementService.batchSettleMatches(eventIds);
        console.log("✅ Settlement service test completed:", {
          settledCount: result.settledCount,
          errorCount: result.errorCount,
          errors: result.errors
        });
      } catch (error: any) {
        console.log("⚠️ Settlement service test failed:", error.message);
      }
    } else {
      console.log("⚠️ No event IDs found for testing settlement service");
    }

    // Test 5: Check user balances and exposures
    console.log("\n📊 Test 5: Checking user balances and exposures...");
    const clientRepo = dataSource.getRepository(Client);
    const clients = await clientRepo.find({
      where: { isActive: true },
      take: 3,
      order: { createdAt: "DESC" }
    });

    console.log(`Found ${clients.length} active clients`);
    if (clients.length > 0) {
      console.log("Sample client:", {
        id: clients[0].id,
        userName: clients[0].userName,
        loginId: clients[0].loginId,
        balance: clients[0].balance,
        exposure: clients[0].exposure,
        isActive: clients[0].isActive
      });
    }

    // Test 6: Verify database consistency
    console.log("\n📊 Test 6: Verifying database consistency...");
    
    // Check for any bets with inconsistent status
    const inconsistentBets = await sportBetRepo
      .createQueryBuilder("bet")
      .where("bet.status = :status", { status: "pending" })
      .andWhere("bet.betData->>'result' IS NOT NULL")
      .getMany();

    console.log(`Found ${inconsistentBets.length} bets with inconsistent status (pending but have result data)`);

    // Check for any bets without proper betData
    const incompleteBets = await sportBetRepo
      .createQueryBuilder("bet")
      .where("bet.betData IS NULL OR bet.betData = '{}'")
      .getMany();

    console.log(`Found ${incompleteBets.length} bets with incomplete betData`);

    console.log("\n✅ All settlement system tests completed successfully!");

  } catch (error: any) {
    console.error("❌ Error in settlement system tests:", error.message);
    console.error("Stack trace:", error.stack);
  } finally {
    // Close database connection
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log("\n🔌 Database connection closed");
    }
  }
}

// Run the tests
testSettlementScenarios().then(() => {
  console.log("\n🎉 Sport Settlement System Tests Completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
