import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { DefaultCasino } from '../../entities/casino/DefaultCasino';
import { WhitelistCasinoMapping } from '../../entities/whitelist/WhitelistCasinoMapping';
import { Whitelist } from '../../entities/whitelist/Whitelist';

/**
 * Configure all casinos for a specific whitelist panel
 */
export const configureAllCasinosForWhitelist = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { whitelistId } = req.params;
    const { 
      isActive = true, 
      startDisplayOrder = 1,
      featuredCasinos = [], // Array of casino slugs to mark as featured
      customSettings = null 
    } = req.body;

    if (!whitelistId) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID is required'
      });
    }

    const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
    const casinoRepo = queryRunner.manager.getRepository(DefaultCasino);
    const mappingRepo = queryRunner.manager.getRepository(WhitelistCasinoMapping);

    // Verify whitelist exists
    const whitelist = await whitelistRepo.findOne({ where: { id: whitelistId } });
    if (!whitelist) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Whitelist not found'
      });
    }

    // Get all casinos from database
    const allCasinos = await casinoRepo.find({
      order: { gameName: 'ASC' }
    });

    if (allCasinos.length === 0) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'No casinos found in database'
      });
    }

    // Clear existing mappings for this whitelist
    await mappingRepo.delete({ whitelistId });

    // Create mappings for all casinos
    const newMappings = allCasinos.map((casino, index) => {
      const isFeatured = featuredCasinos.includes(casino.slug);
      
      return mappingRepo.create({
        whitelistId,
        casinoId: casino.id,
        isActive,
        displayOrder: startDisplayOrder + index,
        isFeatured,
        customSettings
      });
    });

    const savedMappings = await mappingRepo.save(newMappings);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: `Successfully configured ${allCasinos.length} casinos for whitelist panel`,
      data: {
        whitelistId,
        totalCasinos: allCasinos.length,
        activeCasinos: savedMappings.filter(m => m.isActive).length,
        featuredCasinos: savedMappings.filter(m => m.isFeatured).length,
        casinos: allCasinos.map(casino => ({
          id: casino.id,
          gameName: casino.gameName,
          slug: casino.slug,
          category: casino.category,
          provider: casino.provider
        }))
      }
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error configuring all casinos for whitelist:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

/**
 * Get whitelist by name (for easier identification)
 */
export const getWhitelistByName = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Whitelist name is required'
      });
    }

    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    
    const whitelist = await whitelistRepo.findOne({
      where: { CommonName: name }
    });

    if (!whitelist) {
      return res.status(404).json({
        success: false,
        error: 'Whitelist not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: whitelist
    });
  } catch (error: any) {
    console.error('Error fetching whitelist by name:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};






