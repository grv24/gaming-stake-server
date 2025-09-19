#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Fetch Missing Casino Result
 * 
 * Purpose: Try to fetch result data from third-party API for the missing match
 */

import axios from "axios";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function fetchMissingResult() {
  try {
    console.log("🔍 Attempting to fetch missing casino result...");
    
    const matchId = '118250919060021';
    const casinoType = 'dt6';
    
    console.log(`\n🎯 Fetching result for ${casinoType}:${matchId}`);
    
    // Try to fetch from the third-party API
    const apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult_new?roundId=${matchId}&gtype=${casinoType}`;
    console.log(`📡 API URL: ${apiUrl}`);
    
    const response = await axios.get(apiUrl, { timeout: 10000 });
    
    console.log(`\n📊 API Response Status: ${response.status}`);
    console.log(`📊 API Response Data:`, JSON.stringify(response.data, null, 2));
    
    if (response.data.error === false && response.data.data?.success) {
      const apiData = response.data.data;
      
      if (Array.isArray(apiData.data)) {
        const result = apiData.data.find(
          (item: any) => String(item.mid) === String(matchId)
        );
        
        if (result) {
          console.log(`\n✅ Found result data:`, JSON.stringify(result, null, 2));
          
          // Test the settlement logic with this result
          console.log(`\n🧪 Testing settlement logic...`);
          const { settleDragonTiger } = await import("../controllers/casino/settlement/game/DragonTiger6");
          const winners = settleDragonTiger(result);
          console.log(`🏆 Winning SIDs: [${winners.join(', ')}]`);
          
          // Check if the user's bet would win
          const userBetSid = '15'; // Tiger Black
          const isWinner = winners.includes(userBetSid);
          console.log(`\n${isWinner ? '✅ WINNER!' : '❌ LOSER!'} User's SID ${userBetSid} ${isWinner ? 'is' : 'is not'} in winning SIDs`);
          
        } else {
          console.log(`❌ No result found for match ID ${matchId} in API response`);
        }
      } else if (apiData.data?.t1) {
        console.log(`\n✅ Found result data (t1):`, JSON.stringify(apiData.data.t1, null, 2));
      } else {
        console.log(`❌ Unexpected API response format`);
      }
    } else {
      console.log(`❌ API returned error:`, response.data);
    }
    
  } catch (error: any) {
    console.error("❌ Error fetching result:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Run the fetch
fetchMissingResult().then(() => {
  console.log("\n✅ Result fetch completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

