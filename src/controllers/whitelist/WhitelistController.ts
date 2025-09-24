import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { isUUID } from 'class-validator';
import { Like } from 'typeorm';

export const createWhitelist = async (req: Request, res: Response) => {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const whitelistRepo = queryRunner.manager.getRepository(Whitelist);

    const createdById = req.user?.userId;

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

    // Check for existing whitelist with any of the provided URLs
    const clientUrls = Array.isArray(req.body.ClientUrl) ? req.body.ClientUrl : 
                      (req.body.ClientUrl ? [req.body.ClientUrl] : []);
    
    const urlsToCheck = [
      req.body.TechAdminUrl,
      req.body.AdminUrl,
      ...clientUrls
    ].filter(url => url && url.trim() !== '');

    const existingWhitelist = await whitelistRepo.query(`
      SELECT * FROM whitelist_updated 
      WHERE "TechAdminUrl" = ANY($1) 
         OR "AdminUrl" = ANY($1) 
         OR "ClientUrl" && $1
    `, [urlsToCheck]);

    if (existingWhitelist && existingWhitelist.length > 0) {
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
        ClientUrl: Array.isArray(req.body.ClientUrl) ? req.body.ClientUrl : 
            (req.body.ClientUrl ? [req.body.ClientUrl] : []),
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

      // Payment Gateway Settings
      isPaymentGatewayEnabled: req.body.isPaymentGatewayEnabled !== undefined ? 
        req.body.isPaymentGatewayEnabled : false,

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
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
    const { id } = req.params;
    const updatedById = req.user?.userId;

    if (!id) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Whitelist ID is required'
      });
    }

    if (!isUUID(id)) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Invalid whitelist ID format'
      });
    }

    // Find existing whitelist
    const existingWhitelist = await whitelistRepo.findOneBy({ id });
    if (!existingWhitelist) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        error: 'Whitelist not found'
      });
    }

    // Handle ClientUrl array conversion
    const clientUrls = Array.isArray(req.body.ClientUrl) ? req.body.ClientUrl : 
                      (req.body.ClientUrl ? [req.body.ClientUrl] : existingWhitelist.ClientUrl);

    // Check for URL conflicts (excluding current whitelist)
    const urlsToCheck = [
      req.body.TechAdminUrl || existingWhitelist.TechAdminUrl,
      req.body.AdminUrl || existingWhitelist.AdminUrl,
      ...clientUrls
    ].filter(url => url && url.trim() !== '');

    const conflictingWhitelist = await whitelistRepo.query(`
      SELECT * FROM whitelist_updated 
      WHERE id != $1 
        AND ("TechAdminUrl" = ANY($2) 
             OR "AdminUrl" = ANY($2) 
             OR "ClientUrl" && $2)
    `, [id, urlsToCheck]);

    if (conflictingWhitelist && conflictingWhitelist.length > 0) {
      await queryRunner.rollbackTransaction();
      return res.status(409).json({
        success: false,
        error: 'A whitelist entry with one of these URLs already exists'
      });
    }

    // Validate refund percentage if refund option is active
    if (req.body.refundOptionIsActive &&
        (req.body.refundPercentage < 0 || req.body.refundPercentage > 100)) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        error: 'Refund percentage must be between 0 and 100'
      });
    }

    // Prepare update data
    const updateData = {
      // Domain permissions
      isDomainWhiteListedForSportScore: req.body.isDomainWhiteListedForSportScore !== undefined ? 
        req.body.isDomainWhiteListedForSportScore : existingWhitelist.isDomainWhiteListedForSportScore,
      isDomainWhiteListedForSportVideos: req.body.isDomainWhiteListedForSportVideos !== undefined ? 
        req.body.isDomainWhiteListedForSportVideos : existingWhitelist.isDomainWhiteListedForSportVideos,
      isDomainWhiteListedForCasinoVideos: req.body.isDomainWhiteListedForCasinoVideos !== undefined ? 
        req.body.isDomainWhiteListedForCasinoVideos : existingWhitelist.isDomainWhiteListedForCasinoVideos,
      isDomainWhiteListedForIntCasinoGames: req.body.isDomainWhiteListedForIntCasinoGames !== undefined ? 
        req.body.isDomainWhiteListedForIntCasinoGames : existingWhitelist.isDomainWhiteListedForIntCasinoGames,

      // URLs
      TechAdminUrl: req.body.TechAdminUrl || existingWhitelist.TechAdminUrl,
      AdminUrl: req.body.AdminUrl !== undefined ? req.body.AdminUrl : existingWhitelist.AdminUrl,
      ClientUrl: clientUrls,

      // Basic info
      CommonName: req.body.CommonName || existingWhitelist.CommonName,
      websiteTitle: req.body.websiteTitle !== undefined ? req.body.websiteTitle : existingWhitelist.websiteTitle,
      websiteMetaTags: req.body.websiteMetaTags !== undefined ? req.body.websiteMetaTags : existingWhitelist.websiteMetaTags,

      // Theme colors
      primaryBackground: req.body.primaryBackground || existingWhitelist.primaryBackground,
      primaryBackground90: req.body.primaryBackground90 || existingWhitelist.primaryBackground90,
      secondaryBackground: req.body.secondaryBackground || existingWhitelist.secondaryBackground,
      secondaryBackground70: req.body.secondaryBackground70 || existingWhitelist.secondaryBackground70,
      secondaryBackground85: req.body.secondaryBackground85 || existingWhitelist.secondaryBackground85,
      textPrimary: req.body.textPrimary || existingWhitelist.textPrimary,
      textSecondary: req.body.textSecondary || existingWhitelist.textSecondary,

      // Odds configuration
      matchOdd: req.body.matchOdd || existingWhitelist.matchOdd,
      matchOddOptions: req.body.matchOddOptions || existingWhitelist.matchOddOptions,
      bookMakerOdd: req.body.bookMakerOdd || existingWhitelist.bookMakerOdd,
      normalOdd: req.body.normalOdd || existingWhitelist.normalOdd,

      // Refund settings
      refundOptionIsActive: req.body.refundOptionIsActive !== undefined ? 
        req.body.refundOptionIsActive : existingWhitelist.refundOptionIsActive,
      refundPercentage: req.body.refundPercentage !== undefined ? 
        req.body.refundPercentage : existingWhitelist.refundPercentage,
      refundLimit: req.body.refundLimit !== undefined ? 
        req.body.refundLimit : existingWhitelist.refundLimit,
      minDeposit: req.body.minDeposit !== undefined ? 
        req.body.minDeposit : existingWhitelist.minDeposit,

      // Features
      autoSignUpFeature: req.body.autoSignUpFeature !== undefined ? 
        req.body.autoSignUpFeature : existingWhitelist.autoSignUpFeature,
      autoSignUpAssignedUplineId: req.body.autoSignUpAssignedUplineId !== undefined ? 
        req.body.autoSignUpAssignedUplineId : existingWhitelist.autoSignUpAssignedUplineId,
      whatsappNumber: req.body.whatsappNumber !== undefined ? 
        req.body.whatsappNumber : existingWhitelist.whatsappNumber,
      googleAnalyticsTrackingId: req.body.googleAnalyticsTrackingId !== undefined ? 
        req.body.googleAnalyticsTrackingId : existingWhitelist.googleAnalyticsTrackingId,
      loginWithDemoIdFeature: req.body.loginWithDemoIdFeature !== undefined ? 
        req.body.loginWithDemoIdFeature : existingWhitelist.loginWithDemoIdFeature,

      // Status and logo
      isActive: req.body.isActive !== undefined ? req.body.isActive : existingWhitelist.isActive,
      Logo: req.body.Logo !== undefined ? req.body.Logo : existingWhitelist.Logo,

      // Panel settings and payment gateway settings
      panelSettings: req.body.panelSettings !== undefined ? 
        req.body.panelSettings : existingWhitelist.panelSettings,
      isPaymentGatewayEnabled: req.body.isPaymentGatewayEnabled !== undefined ? 
        req.body.isPaymentGatewayEnabled : existingWhitelist.isPaymentGatewayEnabled,

      // Keep original createdById
      createdById: existingWhitelist.createdById
    };

    // Update the whitelist
    await whitelistRepo.update(id, updateData);
    await queryRunner.commitTransaction();

    // Fetch updated whitelist
    const updatedWhitelist = await whitelistRepo.findOneBy({ id });

    res.status(200).json({
      success: true,
      message: 'Whitelist updated successfully',
      data: {
        whitelist: updatedWhitelist
      }
    });

  } catch (error: any) {
    await queryRunner.rollbackTransaction();
    console.error('Error updating whitelist:', error);
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
    const userType = req.query.userType as string || 'client'; // client, admin, techAdmin

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "url query parameter is required" });
    }

    const whitelistRepo = AppDataSource.getRepository(Whitelist);

    // Enhanced query to check all URL fields including ClientUrl array
    const whitelist = await whitelistRepo.query(`
      SELECT * FROM whitelist_updated 
      WHERE "ClientUrl" && ARRAY[$1]
         OR "AdminUrl" = $1 
         OR "TechAdminUrl" = $1
      LIMIT 1
    `, [url]);

    if (!whitelist || whitelist.length === 0) {
      return res.status(404).json({ error: "Whitelist not found for the given URL" });
    }

    const whitelistData = whitelist[0];
    
    // Get panel-specific settings based on user type
    const panelSettings = whitelistData.panelSettings || {};
    const userTypeSettings = panelSettings[userType] || {};
    
    // Add panel-specific settings to response
    whitelistData.panelSettings = userTypeSettings;
    
    // Add legacy settings for backward compatibility
    whitelistData.allClientUrls = whitelistData.ClientUrl || [];
    
    // Ensure payment gateway settings are included
    whitelistData.isPaymentGatewayEnabled = whitelistData.isPaymentGatewayEnabled || false;

    return res.json({ 
      data: whitelistData,
      userType: userType,
      panelSettings: userTypeSettings
    });
  } catch (error) {
    console.error("Error fetching whitelist by URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
