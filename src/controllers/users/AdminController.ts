import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../server';
import { Admin } from "../../entities/users/AdminUser";
import { SoccerSettings } from '../../entities/users/utils/SoccerSetting';
import { CricketSettings } from '../../entities/users/utils/CricketSetting';
import { CasinoSettings } from '../../entities/users/utils/CasinoSetting';
import { InternationalCasinoSettings } from '../../entities/users/utils/InternationalCasino';
import { MatkaSettings } from '../../entities/users/utils/MatkaSetting';
import { TennisSettings } from '../../entities/users/utils/TennisSetting';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { isUUID } from 'class-validator';
import { Between, Like } from 'typeorm';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { MiniAdmin } from '../../entities/users/MiniAdminUser';
import { SuperMaster } from '../../entities/users/SuperMasterUser';
import { Master } from '../../entities/users/MasterUser';
import { SuperAgent } from '../../entities/users/SuperAgentUser';
import { Agent } from '../../entities/users/AgentUser';
import { USER_TABLES } from '../../Helpers/users/Roles';
import { getUserSocket } from '../../config/socketHandler';
import { generateTransactionCode } from '../../Helpers/Request/Validation';

export const createAdmin = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const whiteListId = req.user?.whiteListId;

        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const adminRepo = queryRunner.manager.getRepository(Admin);
        const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
        const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
        const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
        const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
        const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
        const internationalCasinoSettingsRepo = queryRunner.manager.getRepository(InternationalCasinoSettings);

        // Validate whiteListId
        const whiteListData = await whitelistRepo.findOne({ where: { id: whiteListId } });
        if (!whiteListData) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid whiteListId UUID is required'
            });
        }

        const {
            loginId,
            user_password,
            groupID,
            referallCode,
            userName,
            countryCode,
            mobile,
            isAutoRegisteredUser = false,
            IpAddress,
            remarks,
            fancyLocked = false,
            bettingLocked = false,
            userLocked = false,
            whatsappNumber,
            topBarRunningMessage,
            liability = 0,
            balance = 0,
            profitLoss = 0,
            freeChips = 0,
            totalSettledAmount = 0,
            creditRef = 0,
            uplineSettlement = 0,
            exposure = 0,
            exposureLimit = 10000000,
            isPanelCommission,
            whiteListAccess = false,
            depositWithdrawlAccess = false,
            canDeleteBets = false,
            canDeleteUsers = false,
            specialPermissions = false,
            enableMultipleLogin = false,
            autoSignUpFeature = false,
            displayUsersOnlineStatus = false,
            refundOptionFeature = false,
            canDeclareResultAsOperator = false,
            allowedNoOfUsers = 8,
            createdUsersCount = 0,
            percentageWiseCommission = true,
            partnerShipWiseCommission = false,
            commissionLena = true,
            commissionDena = false,
            commissionUpline = 0,    // Your commission as upline
            partnershipUpline = 0,    // Your percentage as upline
            soccerSettings = {},
            cricketSettings = {},
            tennisSettings = {},
            matkaSettings = {},
            casinoSettings = {},
            internationalCasinoSettings = {}
        } = req.body;

        // Basic validation
        if (!loginId || !user_password || !whiteListId) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'loginId, password, and whiteListId are required'
            });
        }

        // Validate percentage and commission values
        if (partnershipUpline < 0 || partnershipUpline > 100) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Invalid partnership values. Must be between 0 and 100%'
            });
        }

        if (commissionUpline < 0 || commissionUpline > 100) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Invalid commission values. Must be between 0 and 100%'
            });
        }

        // Check for existing admin
        const existingAdmin = await adminRepo.findOne({ where: { loginId, whiteListId } });
        if (existingAdmin) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create Admin entity with percentage and commission fields
        const adminData = {
            loginId,
            user_password,
            whiteListId,
            uplineId: uplineId || null,
            groupID: groupID || null,
            transactionPassword: generateTransactionCode(8) || "X12341Y1",
            referallCode: referallCode || null,
            userName: userName || null,
            countryCode: countryCode || null,
            mobile: mobile || null,
            isAutoRegisteredUser,
            IpAddress: IpAddress || null,
            remarks: remarks || null,
            fancyLocked,
            bettingLocked,
            userLocked,
            isActive: false,
            whatsappNumber: whatsappNumber || null,
            topBarRunningMessage: topBarRunningMessage || null,
            __type: 'admin',
            isPanelCommission,
            liability,
            balance,
            profitLoss,
            freeChips,
            totalSettledAmount,
            creditRef,
            uplineSettlement,
            exposure,
            exposureLimit,
            whiteListAccess,
            depositWithdrawlAccess,
            canDeleteBets,
            canDeleteUsers,
            specialPermissions,
            enableMultipleLogin,
            autoSignUpFeature,
            displayUsersOnlineStatus,
            refundOptionFeature,
            canDeclareResultAsOperator,
            allowedNoOfUsers,
            createdUsersCount,
            percentageWiseCommission,
            partnerShipWiseCommission,
            commissionLena,
            commissionDena,
            // NEW PERCENTAGE AND COMMISSION FIELDS
            commissionUplineType: req.__type,
            commissionUplineUserId: uplineId,
            commissionUpline,
            commissionOwn: 100 - commissionUpline,
            partnershipUplineType: req.__type,
            partnershipUplineUserId: uplineId,
            partnershipUpline,
            partnershipOwn: 100 - partnershipUpline,
        };

        const savedAdmin = await adminRepo.save(adminData);

        // Helper function to create settings with proper commission distribution
        const createSettings = async (repo: any, settingsData: any, sportType: string) => {
            // Calculate commission distribution based on global settings
            const commissionDistribution = {
                commissionUplineType: settingsData.commissionUplineType || 'admin',
                commissionUplineUserId: settingsData.commissionUplineUserId || uplineId,
                commissionUpline: settingsData.commissionUpline || commissionUpline || 0,
                commissionOwn: settingsData.commissionOwn || 100 - commissionUpline || 0,
                partnershipUplineType: settingsData.partnershipUplineType || 'admin',
                partnershipUplineUserId: settingsData.partnershipUplineUserId || uplineId,
                partnershipUpline: settingsData.partnershipUpline || partnershipUpline || 0,
                partnershipOwn: settingsData.partnershipOwn || 100 - partnershipUpline || 0,
            };

            return repo.save({
                userId: savedAdmin.id,
                user__type: 'admin',
                ...settingsData,
                ...commissionDistribution
            });
        };

        // Create all settings in parallel
        const [
            savedSoccerSettings,
            savedCricketSettings,
            savedTennisSettings,
            savedMatkaSettings,
            savedCasinoSettings,
            savedInternationalCasinoSettings
        ] = await Promise.all([
            createSettings(soccerSettingsRepo, {
                isWhiteListed: soccerSettings.isWhiteListed || false,
                minOddsToBet: soccerSettings.minOddsToBet || 1.01,
                maxOddsToBet: soccerSettings.maxOddsToBet || 24,
                sportId: soccerSettings.sportId || null,
                betDelay: soccerSettings.betDelay || 1,
                bookMakerDelay: soccerSettings.bookMakerDelay || 1,
                minMatchStake: soccerSettings.minMatchStake || 100,
                maxMatchStake: soccerSettings.maxMatchStake || 100,
                minBookMakerStake: soccerSettings.minBookMakerStake || 100,
                maxBookMakerStake: soccerSettings.maxBookMakerStake || 1,
                maxProfit: soccerSettings.maxProfit || 0,
                maxLoss: soccerSettings.maxLoss || 0,
                minExposure: soccerSettings.minExposure || 0,
                maxExposure: soccerSettings.maxExposure || 0,
                winningLimit: soccerSettings.winningLimit || 0
            }, 'soccer'),
            createSettings(cricketSettingsRepo, {
                isWhiteListed: cricketSettings.isWhiteListed || false,
                min_Odds_To_Bet: cricketSettings.min_Odds_To_Bet || 1.01,
                max_Odds_To_Bet: cricketSettings.max_Odds_To_Bet || 24,
                sportId: cricketSettings.sportId || null,
                betDelay: cricketSettings.betDelay || 1,
                bookMakerDelay: cricketSettings.bookMakerDelay || 1,
                sessionDelay: cricketSettings.sessionDelay || 1,
                minMatchStake: cricketSettings.minMatchStake || 100,
                maxMatchStake: cricketSettings.maxMatchStake || 1,
                minBookMakerStake: cricketSettings.minBookMakerStake || 100,
                maxBookMakerStake: cricketSettings.maxBookMakerStake || 1,
                minSessionStake: cricketSettings.minSessionStake || 100,
                maxSessionStake: cricketSettings.maxSessionStake || 1,
                maxProfit: cricketSettings.maxProfit || 0,
                maxLoss: cricketSettings.maxLoss || 0,
                sessionMaxProfit: cricketSettings.sessionMaxProfit || 0,
                sessionMaxLoss: cricketSettings.sessionMaxLoss || 0,
                minExposure: cricketSettings.minExposure || 0,
                maxExposure: cricketSettings.maxExposure || 0,
                winningLimit: cricketSettings.winningLimit || 0
            }, 'cricket'),
            createSettings(tennisSettingsRepo, {
                isWhiteListed: tennisSettings.isWhiteListed || false,
                minOddsToBet: tennisSettings.minOddsToBet || 1.01,
                maxOddsToBet: tennisSettings.maxOddsToBet || 24,
                sportId: tennisSettings.sportId || null,
                betDelay: tennisSettings.betDelay || 1,
                bookMakerDelay: tennisSettings.bookMakerDelay || 1,
                minMatchStake: tennisSettings.minMatchStake || 100,
                maxMatchStake: tennisSettings.maxMatchStake || 100,
                minBookMakerStake: tennisSettings.minBookMakerStake || 100,
                maxBookMakerStake: tennisSettings.maxBookMakerStake || 1,
                maxProfit: tennisSettings.maxProfit || 0,
                maxLoss: tennisSettings.maxLoss || 0,
                minExposure: tennisSettings.minExposure || 0,
                maxExposure: tennisSettings.maxExposure || 0,
                winningLimit: tennisSettings.winningLimit || 0
            }, 'tennis'),
            createSettings(matkaSettingsRepo, {
                isWhiteListed: matkaSettings.isWhiteListed || false,
                minOddsToBet: matkaSettings.minOddsToBet || 1.01,
                maxOddsToBet: matkaSettings.maxOddsToBet || 24,
                betDelay: matkaSettings.betDelay || 1,
                minMatchStake: matkaSettings.minMatchStake || 100,
                maxMatchStake: matkaSettings.maxMatchStake || 100,
                maxProfit: matkaSettings.maxProfit || 0,
                maxLoss: matkaSettings.maxLoss || 0,
                minExposure: matkaSettings.minExposure || 0,
                maxExposure: matkaSettings.maxExposure || 0,
                winningLimit: matkaSettings.winningLimit || 0
            }, 'matka'),
            createSettings(casinoSettingsRepo, {
                isWhiteListed: casinoSettings.isWhiteListed || false,
                minOddsToBet: casinoSettings.minOddsToBet || 1.01,
                maxOddsToBet: casinoSettings.maxOddsToBet || 24,
                betDelay: casinoSettings.betDelay || 1,
                minMatchStake: casinoSettings.minMatchStake || 100,
                maxMatchStake: casinoSettings.maxMatchStake || 100,
                maxProfit: casinoSettings.maxProfit || 0,
                maxLoss: casinoSettings.maxLoss || 0,
                minExposure: casinoSettings.minExposure || 0,
                maxExposure: casinoSettings.maxExposure || 0,
                winningLimit: casinoSettings.winningLimit || 0
            }, 'casino'),
            createSettings(internationalCasinoSettingsRepo, {
                isWhiteListed: internationalCasinoSettings.isWhiteListed || false,
                minOddsToBet: internationalCasinoSettings.minOddsToBet || 1.01,
                maxOddsToBet: internationalCasinoSettings.maxOddsToBet || 24,
                betDelay: internationalCasinoSettings.betDelay || 1,
                minMatchStake: internationalCasinoSettings.minMatchStake || 100,
                maxMatchStake: internationalCasinoSettings.maxMatchStake || 100,
                maxProfit: internationalCasinoSettings.maxProfit || 0,
                maxLoss: internationalCasinoSettings.maxLoss || 0,
                minExposure: internationalCasinoSettings.minExposure || 0,
                maxExposure: internationalCasinoSettings.maxExposure || 0,
                winningLimit: internationalCasinoSettings.winningLimit || 0
            }, 'internationalCasino')
        ]);

        // Update Admin with settings IDs
        await adminRepo.update(savedAdmin.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            internationalCasinoSettingId: savedInternationalCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...adminWithoutPassword } = savedAdmin;
        const responseData = {
            ...adminWithoutPassword,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            internationalCasinoSettings: savedInternationalCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'Admin created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating Admin:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

// export const createAdmin = async (req: Request, res: Response) => {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//         const uplineId = req.user?.userId;
//         const whiteListId = req.user?.whiteListId;

//         const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
//         const adminRepo = queryRunner.manager.getRepository(Admin);
//         const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
//         const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
//         const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
//         const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
//         const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
//         const internationalCasinoSettingsRepo = queryRunner.manager.getRepository(InternationalCasinoSettings);

//         // Validate whiteListId
//         const whiteListData = await whitelistRepo.findOne({ where: { id: whiteListId } });
//         if (!whiteListData) {
//             await queryRunner.rollbackTransaction();
//             return res.status(400).json({
//                 success: false,
//                 error: 'Valid whiteListId UUID is required'
//             });
//         }

//         const {
//             loginId,
//             user_password,
//             groupID,
//             referallCode,
//             userName,
//             countryCode,
//             mobile,
//             isAutoRegisteredUser = false,
//             IpAddress,
//             remarks,
//             fancyLocked = false,
//             bettingLocked = false,
//             userLocked = false,
//             whatsappNumber,
//             topBarRunningMessage,
//             liability = 0,
//             balance = 0,
//             profitLoss = 0,
//             freeChips = 0,
//             totalSettledAmount = 0,
//             creditRef = 0,
//             uplineSettlement = 0,
//             exposure = 0,
//             exposureLimit = 10000000,
//             isPanelCommission,
//             whiteListAccess = false,
//             depositWithdrawlAccess = false,
//             canDeleteBets = false,
//             canDeleteUsers = false,
//             specialPermissions = false,
//             enableMultipleLogin = false,
//             autoSignUpFeature = false,
//             displayUsersOnlineStatus = false,
//             refundOptionFeature = false,
//             canDeclareResultAsOperator = false,
//             allowedNoOfUsers = 8,
//             createdUsersCount = 0,
//             percentageWiseCommission = true,
//             partnerShipWiseCommission = false,
//             commissionLena = true,
//             commissionDena = false,
//             commissionToType,
//             matchCommission,
//             partnershipToType,
//             partnership,
//             soccerSettings = {},
//             cricketSettings = {},
//             tennisSettings = {},
//             matkaSettings = {},
//             casinoSettings = {},
//             internationalCasinoSettings = {}
//         } = req.body;

//         // Basic validation
//         if (!loginId || !user_password || !whiteListId) {
//             await queryRunner.rollbackTransaction();
//             return res.status(400).json({
//                 success: false,
//                 error: 'loginId, password, and whiteListId are required'
//             });
//         }

//         // Check for existing admin
//         const existingAdmin = await adminRepo.findOne({ where: { loginId, whiteListId } });
//         if (existingAdmin) {
//             await queryRunner.rollbackTransaction();
//             return res.status(409).json({
//                 success: false,
//                 error: 'loginId already exists'
//             });
//         }

//         // Create Admin entity
//         const adminData = {
//             loginId,
//             user_password,
//             whiteListId,
//             uplineId: uplineId || null,
//             groupID: groupID || null,
//             transactionPassword: generateTransactionCode(8) || "X12341Y1",
//             referallCode: referallCode || null,
//             userName: userName || null,
//             countryCode: countryCode || null,
//             mobile: mobile || null,
//             isAutoRegisteredUser,
//             IpAddress: IpAddress || null,
//             remarks: remarks || null,
//             fancyLocked,
//             bettingLocked,
//             userLocked,
//             isActive: false,
//             whatsappNumber: whatsappNumber || null,
//             topBarRunningMessage: topBarRunningMessage || null,
//             __type: 'admin',
//             isPanelCommission,
//             liability,
//             balance,
//             profitLoss,
//             freeChips,
//             totalSettledAmount,
//             creditRef,
//             uplineSettlement,
//             exposure,
//             exposureLimit,
//             whiteListAccess,
//             depositWithdrawlAccess,
//             canDeleteBets,
//             canDeleteUsers,
//             specialPermissions,
//             enableMultipleLogin,
//             autoSignUpFeature,
//             displayUsersOnlineStatus,
//             refundOptionFeature,
//             canDeclareResultAsOperator,
//             allowedNoOfUsers,
//             createdUsersCount,
//             percentageWiseCommission,
//             partnerShipWiseCommission,
//             commissionLena,
//             commissionDena,
//             commissionToType,
//             commissionToUserId: uplineId,
//             matchCommission,
//             partnershipToType,
//             partnershipToUserId: uplineId,
//             partnership,
//         };

//         const savedAdmin = await adminRepo.save(adminData);

//         // Helper function to create settings
//         const createSettings = async (repo: any, settingsData: any) => {
//             return repo.save({
//                 userId: savedAdmin.id,
//                 user__type: 'admin',
//                 ...settingsData
//             });
//         };

//         // Create all settings in parallel
//         const [
//             savedSoccerSettings,
//             savedCricketSettings,
//             savedTennisSettings,
//             savedMatkaSettings,
//             savedCasinoSettings,
//             savedInternationalCasinoSettings
//         ] = await Promise.all([
//             createSettings(soccerSettingsRepo, {
//                 isWhiteListed: soccerSettings.isWhiteListed || false,
//                 minOddsToBet: soccerSettings.minOddsToBet || 1.01,
//                 maxOddsToBet: soccerSettings.maxOddsToBet || 24,
//                 sportId: soccerSettings.sportId || null,
//                 betDelay: soccerSettings.betDelay || 1,
//                 bookMakerDelay: soccerSettings.bookMakerDelay || 1,
//                 minMatchStake: soccerSettings.minMatchStake || 100,
//                 maxMatchStake: soccerSettings.maxMatchStake || 100,
//                 minBookMakerStake: soccerSettings.minBookMakerStake || 100,
//                 maxBookMakerStake: soccerSettings.maxBookMakerStake || 1,
//                 maxProfit: soccerSettings.maxProfit || 0,
//                 maxLoss: soccerSettings.maxLoss || 0,
//                 minExposure: soccerSettings.minExposure || 0,
//                 maxExposure: soccerSettings.maxExposure || 0,
//                 winningLimit: soccerSettings.winningLimit || 0,
//                 commissionToType: soccerSettings.commissionToType || 'admin',
//                 commissionToUserId: soccerSettings.commissionToUserId || null,
//                 matchCommission: soccerSettings.matchCommission || 0,
//                 partnershipToType: soccerSettings.partnershipToType || 'admin',
//                 partnershipToUserId: soccerSettings.partnershipToUserId || null,
//                 partnership: soccerSettings.partnership || 0
//             }),
//             createSettings(cricketSettingsRepo, {
//                 isWhiteListed: cricketSettings.isWhiteListed || false,
//                 min_Odds_To_Bet: cricketSettings.min_Odds_To_Bet || 1.01,
//                 max_Odds_To_Bet: cricketSettings.max_Odds_To_Bet || 24,
//                 sportId: cricketSettings.sportId || null,
//                 betDelay: cricketSettings.betDelay || 1,
//                 bookMakerDelay: cricketSettings.bookMakerDelay || 1,
//                 sessionDelay: cricketSettings.sessionDelay || 1,
//                 minMatchStake: cricketSettings.minMatchStake || 100,
//                 maxMatchStake: cricketSettings.maxMatchStake || 1,
//                 minBookMakerStake: cricketSettings.minBookMakerStake || 100,
//                 maxBookMakerStake: cricketSettings.maxBookMakerStake || 1,
//                 minSessionStake: cricketSettings.minSessionStake || 100,
//                 maxSessionStake: cricketSettings.maxSessionStake || 1,
//                 maxProfit: cricketSettings.maxProfit || 0,
//                 maxLoss: cricketSettings.maxLoss || 0,
//                 sessionMaxProfit: cricketSettings.sessionMaxProfit || 0,
//                 sessionMaxLoss: cricketSettings.sessionMaxLoss || 0,
//                 minExposure: cricketSettings.minExposure || 0,
//                 maxExposure: cricketSettings.maxExposure || 0,
//                 winningLimit: cricketSettings.winningLimit || 0,
//                 commissionToType: cricketSettings.commissionToType || 'admin',
//                 commissionToUserId: cricketSettings.commissionToUserId || null,
//                 matchCommission: cricketSettings.matchCommission || 0,
//                 partnershipToType: cricketSettings.partnershipToType || 'admin',
//                 partnershipToUserId: cricketSettings.partnershipToUserId || null,
//                 partnership: cricketSettings.partnership || 0
//             }),
//             createSettings(tennisSettingsRepo, {
//                 isWhiteListed: tennisSettings.isWhiteListed || false,
//                 minOddsToBet: tennisSettings.minOddsToBet || 1.01,
//                 maxOddsToBet: tennisSettings.maxOddsToBet || 24,
//                 sportId: tennisSettings.sportId || null,
//                 betDelay: tennisSettings.betDelay || 1,
//                 bookMakerDelay: tennisSettings.bookMakerDelay || 1,
//                 minMatchStake: tennisSettings.minMatchStake || 100,
//                 maxMatchStake: tennisSettings.maxMatchStake || 100,
//                 minBookMakerStake: tennisSettings.minBookMakerStake || 100,
//                 maxBookMakerStake: tennisSettings.maxBookMakerStake || 1,
//                 maxProfit: tennisSettings.maxProfit || 0,
//                 maxLoss: tennisSettings.maxLoss || 0,
//                 minExposure: tennisSettings.minExposure || 0,
//                 maxExposure: tennisSettings.maxExposure || 0,
//                 winningLimit: tennisSettings.winningLimit || 0,
//                 commissionToType: tennisSettings.commissionToType || 'admin',
//                 commissionToUserId: tennisSettings.commissionToUserId || null,
//                 matchCommission: tennisSettings.matchCommission || 0,
//                 partnershipToType: tennisSettings.partnershipToType || 'admin',
//                 partnershipToUserId: tennisSettings.partnershipToUserId || null,
//                 partnership: tennisSettings.partnership || 0
//             }),
//             createSettings(matkaSettingsRepo, {
//                 isWhiteListed: matkaSettings.isWhiteListed || false,
//                 minOddsToBet: matkaSettings.minOddsToBet || 1.01,
//                 maxOddsToBet: matkaSettings.maxOddsToBet || 24,
//                 betDelay: matkaSettings.betDelay || 1,
//                 minMatchStake: matkaSettings.minMatchStake || 100,
//                 maxMatchStake: matkaSettings.maxMatchStake || 100,
//                 maxProfit: matkaSettings.maxProfit || 0,
//                 maxLoss: matkaSettings.maxLoss || 0,
//                 minExposure: matkaSettings.minExposure || 0,
//                 maxExposure: matkaSettings.maxExposure || 0,
//                 winningLimit: matkaSettings.winningLimit || 0,
//                 commissionToType: matkaSettings.commissionToType || 'admin',
//                 commissionToUserId: matkaSettings.commissionToUserId || null,
//                 matchCommission: matkaSettings.matchCommission || 0,
//                 partnershipToType: matkaSettings.partnershipToType || 'admin',
//                 partnershipToUserId: matkaSettings.partnershipToUserId || null,
//                 partnership: matkaSettings.partnership || 0
//             }),
//             createSettings(casinoSettingsRepo, {
//                 isWhiteListed: casinoSettings.isWhiteListed || false,
//                 minOddsToBet: casinoSettings.minOddsToBet || 1.01,
//                 maxOddsToBet: casinoSettings.maxOddsToBet || 24,
//                 betDelay: casinoSettings.betDelay || 1,
//                 minMatchStake: casinoSettings.minMatchStake || 100,
//                 maxMatchStake: casinoSettings.maxMatchStake || 100,
//                 maxProfit: casinoSettings.maxProfit || 0,
//                 maxLoss: casinoSettings.maxLoss || 0,
//                 minExposure: casinoSettings.minExposure || 0,
//                 maxExposure: casinoSettings.maxExposure || 0,
//                 winningLimit: casinoSettings.winningLimit || 0,
//                 commissionToType: casinoSettings.commissionToType || 'admin',
//                 commissionToUserId: casinoSettings.commissionToUserId || null,
//                 matchCommission: casinoSettings.matchCommission || 0,
//                 partnershipToType: casinoSettings.partnershipToType || 'admin',
//                 partnershipToUserId: casinoSettings.partnershipToUserId || null,
//                 partnership: casinoSettings.partnership || 0
//             }),
//             createSettings(internationalCasinoSettingsRepo, {
//                 isWhiteListed: internationalCasinoSettings.isWhiteListed || false,
//                 minOddsToBet: internationalCasinoSettings.minOddsToBet || 1.01,
//                 maxOddsToBet: internationalCasinoSettings.maxOddsToBet || 24,
//                 betDelay: internationalCasinoSettings.betDelay || 1,
//                 minMatchStake: internationalCasinoSettings.minMatchStake || 100,
//                 maxMatchStake: internationalCasinoSettings.maxMatchStake || 100,
//                 maxProfit: internationalCasinoSettings.maxProfit || 0,
//                 maxLoss: internationalCasinoSettings.maxLoss || 0,
//                 minExposure: internationalCasinoSettings.minExposure || 0,
//                 maxExposure: internationalCasinoSettings.maxExposure || 0,
//                 winningLimit: internationalCasinoSettings.winningLimit || 0,
//                 commissionToType: internationalCasinoSettings.commissionToType || 'admin',
//                 commissionToUserId: internationalCasinoSettings.commissionToUserId || null,
//                 matchCommission: internationalCasinoSettings.matchCommission || 0,
//                 partnershipToType: internationalCasinoSettings.partnershipToType || 'admin',
//                 partnershipToUserId: internationalCasinoSettings.partnershipToUserId || null,
//                 partnership: internationalCasinoSettings.partnership || 0
//             })
//         ]);

//         // Update Admin with settings IDs
//         await adminRepo.update(savedAdmin.id, {
//             soccerSettingId: savedSoccerSettings.id,
//             cricketSettingId: savedCricketSettings.id,
//             tennisSettingId: savedTennisSettings.id,
//             matkaSettingId: savedMatkaSettings.id,
//             casinoSettingId: savedCasinoSettings.id,
//             internationalCasinoSettingId: savedInternationalCasinoSettings.id
//         });

//         await queryRunner.commitTransaction();

//         const { user_password: _, ...adminWithoutPassword } = savedAdmin;
//         const responseData = {
//             ...adminWithoutPassword,
//             soccerSettings: savedSoccerSettings,
//             cricketSettings: savedCricketSettings,
//             tennisSettings: savedTennisSettings,
//             matkaSettings: savedMatkaSettings,
//             casinoSettings: savedCasinoSettings,
//             internationalCasinoSettings: savedInternationalCasinoSettings
//         };

//         return res.status(201).json({
//             success: true,
//             message: 'Admin created successfully with all settings',
//             data: responseData
//         });

//     } catch (error: any) {
//         await queryRunner.rollbackTransaction();
//         console.error('Error creating Admin:', error);

//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     } finally {
//         await queryRunner.release();
//     }
// };



export const getAllAdmin = async (req: Request, res: Response) => {
    try {
        const adminRepo = AppDataSource.getRepository(Admin);

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const { search, isActive, fromDate, toDate } = req.query;

        const where: any = {};

        if (search) {
            where.userName = Like(`%${search}%`);
        }

        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        if (fromDate && toDate) {
            where.createdAt = Between(
                new Date(fromDate as string),
                new Date(toDate as string)
            );
        }

        const [admins, total] = await adminRepo.findAndCount({
            where,
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'fancyLocked', 'userLocked', 'bettingLocked',
                'allowedNoOfUsers', 'createdUsersCount',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'whiteListAccess', 'depositWithdrawlAccess',
                'canDeleteBets', 'canDeleteUsers', 'specialPermissions',
                'enableMultipleLogin', 'autoSignUpFeature', 'displayUsersOnlineStatus',
                'refundOptionFeature', 'canDeclareResultAsOperator',
                'percentageWiseCommission',
                'partnerShipWiseCommission', 'commissionLena', 'commissionDena',
                'createdAt', 'updatedAt'
            ],
            order: { createdAt: 'DESC' },
            skip,
            take: limit
        });

        return res.json({
            success: true,
            data: admins,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching admins:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getAdminById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const adminRepo = AppDataSource.getRepository(Admin);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'admin ID is required'
            });
        }

        // First get the admin with basic info
        const admin = await adminRepo.findOne({
            where: { id },
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'createdAt', 'updatedAt', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'fancyLocked', 'userLocked', 'bettingLocked',
                'allowedNoOfUsers', 'createdUsersCount',
                'soccerSettingId', 'cricketSettingId', 'tennisSettingId',
                'matkaSettingId', 'casinoSettingId', 'internationalCasinoSettingId',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'whiteListAccess', 'depositWithdrawlAccess',
                'canDeleteBets', 'canDeleteUsers', 'specialPermissions',
                'enableMultipleLogin', 'autoSignUpFeature', 'displayUsersOnlineStatus',
                'refundOptionFeature', 'canDeclareResultAsOperator',
                'percentageWiseCommission',
                'partnerShipWiseCommission', 'commissionLena', 'commissionDena'
            ]
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                error: 'admin not found'
            });
        }

        // Get all related settings in parallel for better performance
        const [
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            internationalCasinoSettings
        ] = await Promise.all([
            admin.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: admin.soccerSettingId }
                })
                : Promise.resolve(null),

            admin.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: admin.cricketSettingId }
                })
                : Promise.resolve(null),

            admin.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: admin.tennisSettingId }
                })
                : Promise.resolve(null),

            admin.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: admin.matkaSettingId }
                })
                : Promise.resolve(null),

            admin.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: admin.casinoSettingId }
                })
                : Promise.resolve(null),

            admin.internationalCasinoSettingId
                ? AppDataSource.getRepository(InternationalCasinoSettings).findOne({
                    where: { id: admin.internationalCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...admin,
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            internationalCasinoSettings
        };

        return res.json({
            success: true,
            data: responseData
        });

    } catch (error: any) {
        console.error('Error fetching admin:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

type AdminUserType = 'admin' | 'miniAdmin' | 'superMaster' | 'master' | 'superAgent' | 'agent';

interface TypeSpecificPermissions {
    canDeclareResult: boolean;
    canChangeSettings: boolean;
}

type AdminPermissions = {
    [key in AdminUserType]: TypeSpecificPermissions;
};

const typeSpecificPermissions: AdminPermissions = {
    admin: {
        canDeclareResult: true,
        canChangeSettings: true
    },
    miniAdmin: {
        canDeclareResult: true,
        canChangeSettings: false
    },
    superMaster: {
        canDeclareResult: false,
        canChangeSettings: false
    },
    master: {
        canDeclareResult: false,
        canChangeSettings: false
    },
    superAgent: {
        canDeclareResult: false,
        canChangeSettings: false
    },
    agent: {
        canDeclareResult: false,
        canChangeSettings: false
    }
};

export const adminLogin = async (req: Request, res: Response) => {
    const { IpAddress, loginId, password, hostUrl } = req.body;
    const io = req.app.get('socketio');
    const userIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) throw new Error('JWT_SECRET is not configured');

        if (!loginId || !password || !hostUrl || !IpAddress) {
            return res.status(400).json({
                success: false,
                error: 'loginId, password, hostUrl and IpAddress are required'
            });
        }

        const whiteListRepo = AppDataSource.getRepository(Whitelist);
        const whiteList = await whiteListRepo.findOne({
            where: { AdminUrl: hostUrl }
        });

        if (!whiteList) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - URL not authorized for Admin access'
            });
        }

        // Search through all admin tables to find the user
        let user: any = null;
        let detectedUserType: AdminUserType | null = null;

        for (const [type, entity] of Object.entries(USER_TABLES)) {
            const repo = AppDataSource.getRepository(entity);
            const foundUser = await repo.findOne({
                where: {
                    loginId,
                    whiteListId: whiteList.id
                },
                relations: [
                    'soccerSettings',
                    'cricketSettings',
                    'tennisSettings',
                    'matkaSettings',
                    'casinoSettings',
                    'internationalCasinoSettings'
                ]
            });

            if (foundUser) {
                user = foundUser;
                detectedUserType = type as AdminUserType;
                break;
            }
        }

        if (!user || !detectedUserType) {
            return res.status(401).json({
                success: false,
                error: 'Invalid admin credentials'
            });
        }

        if (user.__type === 'client' || user.__type === 'techAdmin') {
            return res.status(401).json({
                success: false,
                error: 'Invalid Admin account'
            });
        }

        // Authentication checks
        if (user.userLocked) {
            return res.status(403).json({
                success: false,
                error: 'Admin account is not active'
            });
        }

        if (password !== user.user_password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid admin credentials'
            });
        }

        const { user_password: _, ...safeUserData } = user;

        const basePermissions = {
            canDeleteUsers: user.canDeleteUsers,
            canDeleteBets: user.canDeleteBets,
            specialPermissions: user.specialPermissions,
            depositWithdrawlAccess: user.depositWithdrawlAccess
        };

        const token = jwt.sign(
            {
                user: {
                    userId: user.id,
                    PersonalDetails: {
                        userName: user.userName,
                        loginId: user.loginId,
                        user_password: user.user_password,
                        countryCode: user.countryCode,
                        mobile: user.mobile,
                        idIsActive: user.isActive,
                        isAutoRegisteredUser: user.isAutoRegisteredUser
                    },
                    IpAddress: user.IpAddress,
                    transactionPassword: user.transactionPassword,
                    uplineId: user.uplineId,
                    whiteListId: user.whiteListId,
                    fancyLocked: user.fancyLocked,
                    bettingLocked: user.bettingLocked,
                    userLocked: user.userLocked,
                    // closedAccounts: user,
                    __type: user.__type,
                    remarks: user.remarks,
                    // featureAccessPermissions: user,
                    AccountDetails: {
                        liability: user.liability,
                        Balance: user.balance,
                        profitLoss: user.profitLoss,
                        freeChips: user.freeChips,
                        totalSettledAmount: user.totalSettledAmount,
                        Exposure: user.exposure,
                        ExposureLimit: user.exposureLimit,
                        uplineSettlement: user.uplineSettlement,
                    },
                    allowedNoOfUsers: user.allowedNoOfUsers,
                    createdUsersCount: user.createdUsersCount,
                    commissionSettings: {
                        commissionUplineType: user.commissionUplineType,
                        commissionUplineUserId: user.commissionUplineUserId,
                        commissionUpline: user.commissionUpline,
                        commissionOwn: user.commissionOwn,
                        partnershipUplineType: user.partnershipUplineType,
                        partnershipUplineUserId: user.partnershipUplineUserId,
                        partnershipUpline: user.partnershipUpline,
                        partnershipOwn: user.partnershipOwn,
                    },
                    commissionLenaYaDena: {
                        commissionLena: user.commissionLena,
                        commissionDena: user.commissionDena,
                    },
                    groupID: user.groupID,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                },
                userType: detectedUserType,
                permissions: {
                    ...basePermissions,
                    ...typeSpecificPermissions[detectedUserType]
                },
                sessionData: {
                    ip: userIp,
                    userAgent: req.headers['user-agent']
                }
            },
            jwtSecret,
            {
                expiresIn: process.env.JWT_EXPIRES_IN || '12h',
                issuer: process.env.JWT_ISSUER || 'your-issuer',
                algorithm: 'HS256'
            } as jwt.SignOptions
        );

        if (io) {
            const existingSocket = getUserSocket(io, user.id);

            if (existingSocket) {
                existingSocket.emit('forceLogout', {
                    reason: 'DUPLICATE_LOGIN',
                    message: 'Logged in from new device',
                    timestamp: new Date().toISOString()
                });
                existingSocket.disconnect(true);
            }

            io.to('admins').emit('adminLogin', {
                adminId: user.id,
                username: user.loginId,
                userType: detectedUserType,
                ip: userIp,
                timestamp: new Date().toISOString()
            });
        }

        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 12 * 60 * 60 * 1000
        });

        return res.status(200).json({
            status: true,
            message: 'Admin login successful',
            data: {
                token,
                isActive: user.isActive,
                // user: safeUserData,
                userType: detectedUserType,
                socketRequired: true
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);

        const errorMessage = process.env.NODE_ENV === 'development'
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'Internal server error';

        return res.status(500).json({
            status: false,
            message: errorMessage
        });
    }
};

export const changeOwnPassword = async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userType = req.__type as AdminUserType;
        const userId = req.user?.userId;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }

        if (!userType || !userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized - invalid token data'
            });
        }

        const entity = USER_TABLES[userType];
        if (!entity) {
            return res.status(400).json({
                success: false,
                error: `Unsupported user type: ${userType}`
            });
        }

        const repo = AppDataSource.getRepository(entity);

        const user = await repo.findOne({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.user_password !== currentPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password does not match'
            });
        }

        // const transactionCode = generateTransactionCode(8);
        // user.transactionPassword = transactionCode;

        user.user_password = newPassword;
        user.isActive = true;
        await repo.save(user);

        return res.status(200).json({
            success: true,
            message: 'User is now active',
            data: {
                transactionPassword: user.transactionPassword
            }
        });

    } catch (error) {
        console.error('Error changing own password:', error);

        const errorMessage = process.env.NODE_ENV === 'development'
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'Internal server error';

        return res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
};
