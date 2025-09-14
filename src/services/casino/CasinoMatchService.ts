import { DataSource } from "typeorm";
import { CasinoMatchNew } from "../../entities/casino/CasinoMatchNew";
import { getRedisClient } from "../../config/redisConfig";

export class CasinoMatchService {
  private dataSource: DataSource;
  private casinoMatchRepo: any;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
  }

  /**
   * Update casino match record from Redis data
   * @param casinoType - The casino game type
   * @param matchId - The match ID
   * @param casinoType - Optional casino type for filtering
   */
  async updateCasinoMatchFromRedis(casinoType: string, matchId?: string): Promise<any> {
    try {
      const redisClient = getRedisClient();

      // Get current casino data from Redis
      const currentKey = `casino_data:${casinoType}`;
      const resultsKey = `r_${casinoType}`;

      console.log(`[CASINO_MATCH_SERVICE] Fetching data from Redis for ${casinoType}`);

      // Fetch current data from Redis
      const currentRedisData = await redisClient.get(currentKey);
      const resultsRedisData = await redisClient.get(resultsKey);

      let currentData = null;
      let resultsData = [];

      // Parse current data
      if (currentRedisData) {
        try {
          const parsedCurrentData = JSON.parse(currentRedisData);
          currentData = parsedCurrentData?.data;
        } catch (error) {
          console.error(`[CASINO_MATCH_SERVICE] Failed to parse current data for ${casinoType}:`, error);
        }
      }

      // Parse results data
      if (resultsRedisData) {
        try {
          const parsedResultsData = JSON.parse(resultsRedisData);
          resultsData = parsedResultsData?.data?.res || [];
        } catch (error) {
          console.error(`[CASINO_MATCH_SERVICE] Failed to parse results data for ${casinoType}:`, error);
        }
      }

      // Only update current match if we have current data
      if (currentData && currentData.mid) {
        const currentMid = String(currentData.mid);
        
        try {
          // Check if record exists
          const existingMatch = await this.casinoMatchRepo.findOne({
            where: { mid: currentMid }
          });

          if (existingMatch) {
            // Update existing record with current data only
            await this.casinoMatchRepo.update(
              { mid: currentMid },
              { 
                casinoType: casinoType,
                data: currentData,
                // Don't update result or winner if they already exist
                ...(existingMatch.result ? {} : { result: null }),
                ...(existingMatch.winner ? {} : { winner: null })
              }
            );
            console.log(`[CASINO_MATCH_SERVICE] Updated existing casino match record for mid: ${currentMid}`);
          } else {
            // Create new record with current data only
            const newMatch = this.casinoMatchRepo.create({
              mid: currentMid,
              casinoType: casinoType,
              data: currentData,
              result: null,
              winner: null,
            });
            await this.casinoMatchRepo.save(newMatch);
            console.log(`[CASINO_MATCH_SERVICE] Created new casino match record for mid: ${currentMid}`);
          }
        } catch (dbError: any) {
          console.error(`[CASINO_MATCH_SERVICE] Database error while saving current data for mid ${currentMid}:`, dbError);
        }
      } else {
        console.log(`[CASINO_MATCH_SERVICE] No current data found for ${casinoType}`);
      }

      // Update winner field if match exists in results
      if (resultsData && resultsData.length > 0) {
        console.log(`[CASINO_MATCH_SERVICE] Checking ${resultsData.length} results for winner updates`);
        
        for (const result of resultsData) {
          const resultMid = String(result.mid || result.matchId);
          const winner = result.win || result.result || result.winner;

          if (!resultMid || !winner) {
            continue; // Skip if no valid mid or winner
          }

          try {
            // Check if this match exists in our table
            const existingMatch = await this.casinoMatchRepo.findOne({
              where: { mid: resultMid }
            });

            if (existingMatch) {
              // Update only the winner field if it's different
              if (existingMatch.winner !== String(winner)) {
                await this.casinoMatchRepo.update(
                  { mid: resultMid },
                  { 
                    winner: String(winner)
                    // Don't update result field - keep it null for HTTP API updates only
                  }
                );
                console.log(`[CASINO_MATCH_SERVICE] Updated winner for match ${resultMid}: ${winner}`);
              } else {
                console.log(`[CASINO_MATCH_SERVICE] Winner already set for match ${resultMid}: ${winner}`);
              }
            } else {
              console.log(`[CASINO_MATCH_SERVICE] Match ${resultMid} not found in table, skipping winner update`);
            }
          } catch (dbError: any) {
            console.error(`[CASINO_MATCH_SERVICE] Database error while updating winner for mid ${resultMid}:`, dbError);
          }
        }
      } else {
        console.log(`[CASINO_MATCH_SERVICE] No results data found for ${casinoType}`);
      }

      return {
        casinoType,
        currentData: currentData ? { mid: currentData.mid } : null,
        resultsCount: resultsData.length,
        updated: true
      };

    } catch (error: any) {
      console.error(`[CASINO_MATCH_SERVICE] Error updating casino match from Redis for ${casinoType}:`, error);
      throw error;
    }
  }

  /**
   * Update specific casino match by match ID from Redis
   * @param matchId - The match ID to update
   * @param casinoType - Optional casino type for filtering
   */
  async updateCasinoMatchById(matchId: string, casinoType?: string): Promise<any> {
    try {
      const redisClient = getRedisClient();

      // Try to find the match in current data first
      const casinoTypes = casinoType ? [casinoType] : await this.getAllCasinoTypesFromRedis();
      
      for (const type of casinoTypes) {
        const currentKey = `casino_data:${type}`;
        const currentRedisData = await redisClient.get(currentKey);

        if (currentRedisData) {
          try {
            const parsedCurrentData = JSON.parse(currentRedisData);
            const currentData = parsedCurrentData?.data;

            if (currentData && String(currentData.mid) === String(matchId)) {
              // Found the match in current data
              return await this.updateCasinoMatchFromRedis(type, matchId);
            }
          } catch (error) {
            console.error(`[CASINO_MATCH_SERVICE] Error parsing current data for ${type}:`, error);
          }
        }

        // Check results data
        const resultsKey = `r_${type}`;
        const resultsRedisData = await redisClient.get(resultsKey);

        if (resultsRedisData) {
          try {
            const parsedResultsData = JSON.parse(resultsRedisData);
            const resultsData = parsedResultsData?.data?.res || [];

            const foundResult = resultsData.find((result: any) => 
              String(result.mid || result.matchId) === String(matchId)
            );

            if (foundResult) {
              // Found the match in results data
              return await this.updateCasinoMatchFromRedis(type, matchId);
            }
          } catch (error) {
            console.error(`[CASINO_MATCH_SERVICE] Error parsing results data for ${type}:`, error);
          }
        }
      }

      console.log(`[CASINO_MATCH_SERVICE] Match ${matchId} not found in Redis data`);
      return null;

    } catch (error: any) {
      console.error(`[CASINO_MATCH_SERVICE] Error updating casino match by ID ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get all casino types from Redis
   */
  private async getAllCasinoTypesFromRedis(): Promise<string[]> {
    try {
      const redisClient = getRedisClient();
      const casinoDataKeys = await redisClient.keys('casino_data:*');
      const discoveredCasinoTypes = new Set<string>();

      // Extract casino types from casino_data keys
      for (const key of casinoDataKeys) {
        const parts = key.split(':');
        if (parts.length === 2 && parts[0] === 'casino_data') {
          discoveredCasinoTypes.add(parts[1]);
        }
      }

      // Also check for results keys
      const resultsKeys = await redisClient.keys('r_*');
      for (const key of resultsKeys) {
        if (key.startsWith('r_')) {
          const casinoType = key.substring(2);
          discoveredCasinoTypes.add(casinoType);
        }
      }

      return Array.from(discoveredCasinoTypes);
    } catch (error: any) {
      console.error("[CASINO_MATCH_SERVICE] Error getting casino types from Redis:", error);
      return [];
    }
  }

  /**
   * Update all casino matches from Redis data
   */
  async updateAllCasinoMatchesFromRedis(): Promise<any[]> {
    try {
      const casinoTypes = await this.getAllCasinoTypesFromRedis();
      const results = [];

      console.log(`[CASINO_MATCH_SERVICE] Updating all casino matches from Redis for ${casinoTypes.length} casino types`);

      for (const casinoType of casinoTypes) {
        try {
          const result = await this.updateCasinoMatchFromRedis(casinoType);
          results.push(result);
        } catch (error: any) {
          console.error(`[CASINO_MATCH_SERVICE] Error updating ${casinoType}:`, error);
          results.push({ casinoType, error: error.message, updated: false });
        }
      }

      return results;
    } catch (error: any) {
      console.error("[CASINO_MATCH_SERVICE] Error updating all casino matches:", error);
      throw error;
    }
  }

  /**
   * Get casino match from database
   */
  async getCasinoMatch(matchId: string): Promise<CasinoMatchNew | null> {
    try {
      return await this.casinoMatchRepo.findOne({
        where: { mid: matchId }
      });
    } catch (error: any) {
      console.error(`[CASINO_MATCH_SERVICE] Error getting casino match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Get casino matches by casino type
   */
  async getCasinoMatchesByType(casinoType: string, limit: number = 100): Promise<CasinoMatchNew[]> {
    try {
      return await this.casinoMatchRepo.find({
        where: { casinoType },
        order: { createdAt: 'DESC' },
        take: limit
      });
    } catch (error: any) {
      console.error(`[CASINO_MATCH_SERVICE] Error getting casino matches for ${casinoType}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
let casinoMatchServiceInstance: CasinoMatchService | null = null;

export const getCasinoMatchService = (dataSource: DataSource): CasinoMatchService => {
  if (!casinoMatchServiceInstance) {
    casinoMatchServiceInstance = new CasinoMatchService(dataSource);
  }
  return casinoMatchServiceInstance;
};
