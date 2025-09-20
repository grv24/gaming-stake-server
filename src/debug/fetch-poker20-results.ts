#!/usr/bin/env ts-node

/**
 * DEBUG SCRIPT: Fetch Poker20 Results
 * 
 * Purpose: Try to fetch result data from third-party API for Poker20 matches
 */

import axios from "axios";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function fetchPoker20Results() {
  try {
    console.log("🔍 Attempting to fetch Poker20 results...");
    
    const matchIds = ['109250919071557', '109250919071031'];
    const casinoType = 'poker20';
    
    for (const matchId of matchIds) {
      console.log(`\n🎯 Fetching result for ${casinoType}:${matchId}`);
      
      // Try to fetch from the third-party API
      const apiUrl = `${process.env.THIRD_PARTY_URL}/exchange/casino/roundresult_new?roundId=${matchId}&gtype=${casinoType}`;
      console.log(`📡 API URL: ${apiUrl}`);
      
      try {
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
              console.log(`\n🧪 Testing Poker20 settlement logic...`);
              const { settlePoker20Result } = await import("../controllers/casino/settlement/game/Poker20");
              const winners = settlePoker20Result(result);
              console.log(`🏆 Winning SIDs: [${winners.join(', ')}]`);
              
              // Check if the user's bet would win
              const userBetSid = '11'; // Player A Winner
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
      } catch (apiError: any) {
        console.error(`❌ Error fetching result for ${matchId}:`, apiError.message);
        if (apiError.response) {
          console.error("Response status:", apiError.response.status);
          console.error("Response data:", apiError.response.data);
        }
      }
    }
    
  } catch (error: any) {
    console.error("❌ Error fetching Poker20 results:", error.message);
  }
}

// Run the fetch
fetchPoker20Results().then(() => {
  console.log("\n✅ Poker20 results fetch completed");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});




