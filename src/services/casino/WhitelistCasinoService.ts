import { AppDataSource } from '../../server';
import { WhitelistCasinoMapping } from '../../entities/whitelist/WhitelistCasinoMapping';
import { getRedisClient } from '../../config/redisConfig';

/**
 * Get active casino types for a specific whitelist panel
 */
export const getActiveCasinoTypesForWhitelist = async (whitelistId: string): Promise<string[]> => {
  try {
    const mappingRepo = AppDataSource.getRepository(WhitelistCasinoMapping);
    
    const activeMappings = await mappingRepo.find({
      where: { 
        whitelistId,
        isActive: true 
      },
      relations: ['casino']
    });

    return activeMappings.map(mapping => mapping.casino.slug);
  } catch (error) {
    console.error('Error fetching active casino types for whitelist:', error);
    return [];
  }
};

/**
 * Filter casino data based on whitelist panel configuration
 */
export const filterCasinoDataForWhitelist = async (whitelistId: string, casinoData: any): Promise<any> => {
  try {
    const activeCasinoTypes = await getActiveCasinoTypesForWhitelist(whitelistId);
    
    if (activeCasinoTypes.length === 0) {
      return {};
    }

    const filteredData: any = {};
    
    // Filter casino data to only include active casino types for this whitelist
    for (const casinoType of activeCasinoTypes) {
      if (casinoData[casinoType]) {
        filteredData[casinoType] = casinoData[casinoType];
      }
    }

    return filteredData;
  } catch (error) {
    console.error('Error filtering casino data for whitelist:', error);
    return casinoData; // Return original data if filtering fails
  }
};

/**
 * Get casino data from Redis filtered by whitelist panel
 */
export const getCasinoDataForWhitelist = async (whitelistId: string): Promise<any> => {
  try {
    const redis = getRedisClient();
    const activeCasinoTypes = await getActiveCasinoTypesForWhitelist(whitelistId);
    
    if (activeCasinoTypes.length === 0) {
      return {};
    }

    const casinoData: any = {};
    
    // Fetch data for each active casino type
    for (const casinoType of activeCasinoTypes) {
      try {
        const currentData = await redis.get(`casino:${casinoType}:current`);
        const resultsData = await redis.get(`casino:${casinoType}:results`);
        
        if (currentData) {
          casinoData[casinoType] = {
            current: JSON.parse(currentData),
            results: resultsData ? JSON.parse(resultsData) : null
          };
        }
      } catch (error) {
        console.error(`Error fetching data for casino type ${casinoType}:`, error);
      }
    }

    return casinoData;
  } catch (error) {
    console.error('Error getting casino data for whitelist:', error);
    return {};
  }
};

/**
 * Check if a casino type is active for a specific whitelist panel
 */
export const isCasinoActiveForWhitelist = async (whitelistId: string, casinoType: string): Promise<boolean> => {
  try {
    const mappingRepo = AppDataSource.getRepository(WhitelistCasinoMapping);
    
    const mapping = await mappingRepo.findOne({
      where: { 
        whitelistId,
        isActive: true 
      },
      relations: ['casino']
    });

    return mapping?.casino.slug === casinoType;
  } catch (error) {
    console.error('Error checking casino active status for whitelist:', error);
    return false;
  }
};
