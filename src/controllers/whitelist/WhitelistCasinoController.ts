import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { WhitelistCasinoMapping } from '../../entities/whitelist/WhitelistCasinoMapping';
// import { Whitelist } from '../../entities/whitelist/Whitelist';
import { WhitelistNew } from '../../entities/whitelist/WhitelistNew'; // girraj
import { DefaultCasino } from '../../entities/casino/DefaultCasino';
import { developerAuth } from '../../middlewares/RoleAuth';

/**
 * Get all casino mappings for a specific whitelist panel
 */
export const getWhitelistCasinoMappings = async (req: Request, res: Response) => {
  try {
    const { whitelistId } = req.params;

    if (!whitelistId) {
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID is required'
      });
    }

    const mappingRepo = AppDataSource.getRepository(WhitelistCasinoMapping);

    const mappings = await mappingRepo.find({
      where: { whitelistId },
      relations: ['casino'],
      order: { displayOrder: 'ASC', createdAt: 'ASC' }
    });

    return res.status(200).json({
      success: true,
      data: mappings
    });
  } catch (error: any) {
    console.error('Error fetching whitelist casino mappings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get active casinos for a specific whitelist panel
 */
export const getActiveCasinosForWhitelist = async (req: Request, res: Response) => {
  try {
    const { whitelistId } = req.params;

    if (!whitelistId) {
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID is required'
      });
    }

    const mappingRepo = AppDataSource.getRepository(WhitelistCasinoMapping);

    const activeMappings = await mappingRepo.find({
      where: {
        whitelistId,
        isActive: true
      },
      relations: ['casino'],
      order: { displayOrder: 'ASC', createdAt: 'ASC' }
    });

    const activeCasinos = activeMappings.map(mapping => ({
      ...mapping.casino,
      mappingId: mapping.id,
      displayOrder: mapping.displayOrder,
      isFeatured: mapping.isFeatured,
      customSettings: mapping.customSettings
    }));

    return res.status(200).json({
      success: true,
      data: activeCasinos
    });
  } catch (error: any) {
    console.error('Error fetching active casinos for whitelist:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Add casino to whitelist panel
 */
export const addCasinoToWhitelist = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { whitelistId, casinoId, isActive = true, displayOrder = 0, isFeatured = false, customSettings = null } = req.body;

    if (!whitelistId || !casinoId) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID and Casino ID are required'
      });
    }

    const mappingRepo = queryRunner.manager.getRepository(WhitelistCasinoMapping);
    // const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
    const whitelistRepo = queryRunner.manager.getRepository(WhitelistNew);
    const casinoRepo = queryRunner.manager.getRepository(DefaultCasino);

    // Verify whitelist exists
    const whitelist = await whitelistRepo.findOne({ where: { id: whitelistId } });
    if (!whitelist) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Whitelist not found'
      });
    }

    // Verify casino exists
    const casino = await casinoRepo.findOne({ where: { id: casinoId } });
    if (!casino) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Casino not found'
      });
    }

    // Check if mapping already exists
    const existingMapping = await mappingRepo.findOne({
      where: { whitelistId, casinoId }
    });

    if (existingMapping) {
      await queryRunner.rollbackTransaction();
      return res.status(409).json({
        success: false,
        error: 'Casino is already mapped to this whitelist panel'
      });
    }

    // Create new mapping
    const mapping = mappingRepo.create({
      whitelistId,
      casinoId,
      isActive,
      displayOrder,
      isFeatured,
      customSettings
    });

    const savedMapping = await mappingRepo.save(mapping);
    await queryRunner.commitTransaction();

    return res.status(201).json({
      success: true,
      data: savedMapping,
      message: 'Casino successfully added to whitelist panel'
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error adding casino to whitelist:', error);
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
 * Update casino mapping for whitelist panel
 */
export const updateCasinoMapping = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { mappingId } = req.params;
    const { isActive, displayOrder, isFeatured, customSettings } = req.body;

    if (!mappingId) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Mapping ID is required'
      });
    }

    const mappingRepo = queryRunner.manager.getRepository(WhitelistCasinoMapping);

    const mapping = await mappingRepo.findOne({
      where: { id: mappingId },
      relations: ['casino', 'whitelist']
    });

    if (!mapping) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Casino mapping not found'
      });
    }

    // Update fields
    if (typeof isActive === 'boolean') mapping.isActive = isActive;
    if (typeof displayOrder === 'number') mapping.displayOrder = displayOrder;
    if (typeof isFeatured === 'boolean') mapping.isFeatured = isFeatured;
    if (customSettings !== undefined) mapping.customSettings = customSettings;

    const updatedMapping = await mappingRepo.save(mapping);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      data: updatedMapping,
      message: 'Casino mapping updated successfully'
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error updating casino mapping:', error);
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
 * Remove casino from whitelist panel
 */
export const removeCasinoFromWhitelist = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { mappingId } = req.params;

    if (!mappingId) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Mapping ID is required'
      });
    }

    const mappingRepo = queryRunner.manager.getRepository(WhitelistCasinoMapping);

    const mapping = await mappingRepo.findOne({
      where: { id: mappingId },
      relations: ['casino', 'whitelist']
    });

    if (!mapping) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Casino mapping not found'
      });
    }

    await mappingRepo.remove(mapping);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Casino successfully removed from whitelist panel',
      data: {
        removedMapping: mapping
      }
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error removing casino from whitelist:', error);
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
 * Bulk update casino mappings for a whitelist panel
 */
export const bulkUpdateCasinoMappings = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const { whitelistId } = req.params;
    const { casinoMappings } = req.body;

    if (!whitelistId || !casinoMappings || !Array.isArray(casinoMappings)) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID and casino mappings array are required'
      });
    }

    const mappingRepo = queryRunner.manager.getRepository(WhitelistCasinoMapping);

    // Clear existing mappings for this whitelist
    await mappingRepo.delete({ whitelistId });

    // Create new mappings
    const newMappings = casinoMappings.map((mapping: any) =>
      mappingRepo.create({
        whitelistId,
        casinoId: mapping.casinoId,
        isActive: mapping.isActive ?? true,
        displayOrder: mapping.displayOrder ?? 0,
        isFeatured: mapping.isFeatured ?? false,
        customSettings: mapping.customSettings ?? null
      })
    );

    const savedMappings = await mappingRepo.save(newMappings);
    await queryRunner.commitTransaction();

    return res.status(200).json({
      success: true,
      data: savedMappings,
      message: 'Casino mappings updated successfully'
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error bulk updating casino mappings:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    await queryRunner.release();
  }
};


