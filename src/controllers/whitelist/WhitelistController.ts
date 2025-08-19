import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { isUUID } from 'class-validator';

export const createWhitelist = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const whitelistRepo = queryRunner.manager.getRepository(Whitelist);

    const createdById = req.user?.id;

    if (!req.body.TechAdminUrl || !req.body.CommonName || !createdById) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'TechAdminUrl, CommonName, and createdById are required fields'
      });
    }

    if (!isUUID(createdById)) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'createdById must be a valid UUID'
      });
    }

    const existingWhitelist = await whitelistRepo.findOne({
      where: [
        { TechAdminUrl: req.body.TechAdminUrl },
        { AdminUrl: req.body.AdminUrl || '' },
        { ClientUrl: req.body.ClientUrl || '' }
      ]
    });

    if (existingWhitelist) {
      await queryRunner.rollbackTransaction();
      return res.status(409).json({
        success: false,
        error: 'A whitelist entry with one of these URLs already exists'
      });
    }

    const whitelistData = {
      isDomainWhiteListedForSportScore: req.body.isDomainWhiteListedForSportScore || false,
      isDomainWhiteListedForSportVideos: req.body.isDomainWhiteListedForSportVideos || false,
      isDomainWhiteListedForCasinoVideos: req.body.isDomainWhiteListedForCasinoVideos || false,
      isDomainWhiteListedForIntCasinoGames: req.body.isDomainWhiteListedForIntCasinoGames || false,

      TechAdminUrl: req.body.TechAdminUrl,
      AdminUrl: req.body.AdminUrl || '',
      ClientUrl: req.body.ClientUrl || '',
      CommonName: req.body.CommonName,
      websiteTitle: req.body.websiteTitle || '',

      websiteMetaTags: req.body.websiteMetaTags || null,

      primaryBackground: req.body.primaryBackground || '#0D7A8E',
      primaryBackground90: req.body.primaryBackground90 || '#0D7A8E',
      secondaryBackground: req.body.secondaryBackground || '#04303e',
      secondaryBackground70: req.body.secondaryBackground70 || '#AE4600B3',
      secondaryBackground85: req.body.secondaryBackground85 || '#AE4600E6',
      textPrimary: req.body.textPrimary || '#FFFFFF',
      textSecondary: req.body.textSecondary || '#CCCCCC',

      matchOdd: req.body.matchOdd || ['Back', 'Lay'],
      matchOddOptions: req.body.matchOddOptions || [['b3', 'b2', 'b1'], ['l1', 'l2', 'l3']],
      bookMakerOdd: req.body.bookMakerOdd || ['Back', 'Lay'],
      normalOdd: req.body.normalOdd || ['No', 'Yes'],

      refundOptionIsActive: req.body.refundOptionIsActive || false,
      refundPercentage: req.body.refundPercentage || 0,
      refundLimit: req.body.refundLimit || 0,
      minDeposit: req.body.minDeposit || 100,

      autoSignUpFeature: req.body.autoSignUpFeature || false,
      autoSignUpAssignedUplineId: req.body.autoSignUpAssignedUplineId || null,
      whatsappNumber: req.body.whatsappNumber || false,
      googleAnalyticsTrackingId: req.body.googleAnalyticsTrackingId || '',
      loginWithDemoIdFeature: req.body.loginWithDemoIdFeature || false,

      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      Logo: req.body.Logo || '',

      createdById
    };

    // const whitelist = plainToInstance(Whitelist, whitelistData);
    // const errors = await validate(whitelist);

    // if (errors.length > 0) {
    //   await queryRunner.rollbackTransaction();
    //   return res.status(400).json({
    //     success: false,
    //     error: 'Validation failed',
    //     details: errors.map(e => ({
    //       property: e.property,
    //       constraints: e.constraints
    //     }))
    //   });
    // }

    const savedWhitelist = await whitelistRepo.save(whitelistData);
    await queryRunner.commitTransaction();

    const responseData = { ...savedWhitelist };

    res.status(201).json({
      success: true,
      message: 'Whitelist created successfully',
      data: {
        whitelist: responseData
      }
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error creating whitelist:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        stack: error.stack
      } : undefined
    });
  } finally {
    await queryRunner.release();
  }
};

export const getWhitelists = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    const whitelists = id
      ? await whitelistRepo.findOneBy({ id })
      : await whitelistRepo.find();

    if (!whitelists) {
      return res.status(404).json({
        status: "error",
        message: 'Whitelist not found'
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Whitelist fetched successfully",
      data: { whitelists }
    });
  } catch (err: any) {
    console.error('Error fetching whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const saveWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.query;
    const createdById = req.user?.id;

    if (!createdById) {
      return res.status(400).json({
        status: "error",
        message: 'Developer not found',
      });
    }

    const whitelistData = plainToInstance(Whitelist, req.body);
    whitelistData.createdById = createdById;

    const errors = await validate(whitelistData, {
      skipMissingProperties: !!id,
      whitelist: true,
      forbidNonWhitelisted: true
    });

    if (errors.length > 0) {
      const errorMessages = errors.map(error => Object.values(error.constraints || {})).flat();
      return res.status(400).json({
        status: "error",
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    if (!id && (!whitelistData.TechAdminUrl || !whitelistData.AdminUrl || !whitelistData.ClientUrl)) {
      return res.status(400).json({
        status: "error",
        message: 'TechAdminUrl, AdminUrl, and ClientUrl are required for new whitelists'
      });
    }

    if (whitelistData.refundOptionIsActive &&
      (whitelistData.refundPercentage < 0 || whitelistData.refundPercentage > 100)) {
      return res.status(400).json({
        status: "error",
        message: 'Refund percentage must be between 0 and 100'
      });
    }

    let whitelist: Whitelist | null;
    let isNew = false;

    if (id) {
      whitelist = await whitelistRepo.findOneBy({ id } as any);
      if (!whitelist) {
        return res.status(404).json({
          status: "error",
          message: 'Whitelist not found'
        });
      }
      whitelistRepo.merge(whitelist, whitelistData);
    } else {
      whitelist = whitelistData;
      isNew = true;
    }

    const result = whitelist ? await whitelistRepo.save(whitelist) : null;

    return res.status(isNew ? 201 : 200).json({
      status: "success",
      message: `Whitelist ${isNew ? 'created' : 'updated'} successfully`,
      data: { whitelist: result }
    });
  } catch (err: any) {
    console.error('Error saving whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const deleteWhitelist = async (req: Request, res: Response) => {
  try {
    const whitelistRepo = AppDataSource.getRepository(Whitelist);
    const { id } = req.params;

    const result = await whitelistRepo.delete(id);

    if (result.affected === 0) {
      return res.status(404).json({
        status: "error",
        message: 'Whitelist not found'
      });
    }

    return res.status(200).json({
      status: "success",
      message: "Whitelist deleted successfully"
    });
  } catch (err: any) {
    console.error('Error deleting whitelist:', err);
    return res.status(500).json({
      status: "error",
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getWhitelistByUrl = async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url query parameter is required" });
    }

    const whitelistRepo = AppDataSource.getRepository(Whitelist);

    const whitelist = await whitelistRepo.findOne({
      where: [
        { ClientUrl: url },
        { AdminUrl: url },
        { TechAdminUrl: url },
      ],
    });

    if (!whitelist) {
      return res.status(404).json({ error: "Whitelist not found for the given URL" });
    }

    return res.json({ data: whitelist });
  } catch (error) {
    console.error("Error fetching whitelist by URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
