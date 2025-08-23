import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { MiniAdmin } from "../../entities/users/MiniAdminUser";
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
import { generateTransactionCode } from '../../Helpers/Request/Validation';

export const createMiniAdmin = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const whiteListId = req.user?.whiteListId;
        
        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const miniAdminRepo = queryRunner.manager.getRepository(MiniAdmin);
        const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
        const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
        const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
        const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
        const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
        const internationalCasinoSettingsRepo = queryRunner.manager.getRepository(InternationalCasinoSettings);
        
        // Validate whiteListId
        const whiteListData = await whitelistRepo.findOne({ where: { id: whiteListId }});
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
            transactionPassword,
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

        // Check for existing mini admin
        const existingMiniAdmin = await miniAdminRepo.findOne({ where: { loginId, whiteListId } });
        if (existingMiniAdmin) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create MiniAdmin entity with percentage and commission fields
        const miniAdminData = {
            loginId,
            user_password,
            whiteListId,
            uplineId: uplineId || null,
            groupID: groupID || null,
            transactionPassword: generateTransactionCode(10) || "MINIADMIN123",
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
            __type: 'miniAdmin',
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

        const savedMiniAdmin = await miniAdminRepo.save(miniAdminData);

        // Helper function to create settings with proper commission distribution
        const createSettings = async (repo: any, settingsData: any, sportType: string) => {
            // Calculate commission distribution based on global settings
            const commissionDistribution = {
                commissionUplineType: settingsData.commissionUplineType || 'miniAdmin',
                commissionUplineUserId: settingsData.commissionUplineUserId || uplineId,
                commissionUpline: settingsData.commissionUpline || commissionUpline || 0,
                commissionOwn: settingsData.commissionOwn || 100 - commissionUpline || 0,
                partnershipUplineType: settingsData.partnershipUplineType || 'miniAdmin',
                partnershipUplineUserId: settingsData.partnershipUplineUserId || uplineId,
                partnershipUpline: settingsData.partnershipUpline || partnershipUpline || 0,
                partnershipOwn: settingsData.partnershipOwn || 100 - partnershipUpline || 0,
            };

            return repo.save({
                userId: savedMiniAdmin.id,
                user__type: 'miniAdmin',
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

        // Update MiniAdmin with settings IDs
        await miniAdminRepo.update(savedMiniAdmin.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            internationalCasinoSettingId: savedInternationalCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...miniAdminWithoutPassword } = savedMiniAdmin;
        const responseData = {
            ...miniAdminWithoutPassword,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            internationalCasinoSettings: savedInternationalCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'MiniAdmin created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating MiniAdmin:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

// export const createMiniAdmin = async (req: Request, res: Response) => {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//         const uplineId = req.user?.userId;
//         const whiteListId = req.user?.whiteListId;
        
//         const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
//         const miniAdminRepo = queryRunner.manager.getRepository(MiniAdmin);
//         const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
//         const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
//         const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
//         const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
//         const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
//         const internationalCasinoSettingsRepo = queryRunner.manager.getRepository(InternationalCasinoSettings);
        
//         // Validate whiteListId
//         const whiteListData = await whitelistRepo.findOne({ where: { id: whiteListId }});
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
//             transactionPassword,
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

//         // Check for existing mini admin
//         const existingMiniAdmin = await miniAdminRepo.findOne({ where: { loginId, whiteListId } });
//         if (existingMiniAdmin) {
//             await queryRunner.rollbackTransaction();
//             return res.status(409).json({
//                 success: false,
//                 error: 'loginId already exists'
//             });
//         }

//         // Create MiniAdmin entity
//         const miniAdminData = {
//             loginId,
//             user_password,
//             whiteListId,
//             uplineId: uplineId || null,
//             groupID: groupID || null,
//             transactionPassword: transactionPassword || null,
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
//             __type: 'miniAdmin',
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
//              commissionToType,
//             commissionToUserId: uplineId,
//             matchCommission,
//             partnershipToType,
//             partnershipToUserId: uplineId,
//             partnership,
//         };

//         const savedMiniAdmin = await miniAdminRepo.save(miniAdminData);

//         // Helper function to create settings
//         const createSettings = async (repo: any, settingsData: any) => {
//             return repo.save({
//                 userId: savedMiniAdmin.id,
//                 user__type: 'miniAdmin',
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
//                 commissionToType: soccerSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: soccerSettings.commissionToUserId || null,
//                 matchCommission: soccerSettings.matchCommission || 0,
//                 partnershipToType: soccerSettings.partnershipToType || 'miniAdmin',
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
//                 commissionToType: cricketSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: cricketSettings.commissionToUserId || null,
//                 matchCommission: cricketSettings.matchCommission || 0,
//                 partnershipToType: cricketSettings.partnershipToType || 'miniAdmin',
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
//                 commissionToType: tennisSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: tennisSettings.commissionToUserId || null,
//                 matchCommission: tennisSettings.matchCommission || 0,
//                 partnershipToType: tennisSettings.partnershipToType || 'miniAdmin',
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
//                 commissionToType: matkaSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: matkaSettings.commissionToUserId || null,
//                 matchCommission: matkaSettings.matchCommission || 0,
//                 partnershipToType: matkaSettings.partnershipToType || 'miniAdmin',
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
//                 commissionToType: casinoSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: casinoSettings.commissionToUserId || null,
//                 matchCommission: casinoSettings.matchCommission || 0,
//                 partnershipToType: casinoSettings.partnershipToType || 'miniAdmin',
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
//                 commissionToType: internationalCasinoSettings.commissionToType || 'miniAdmin',
//                 commissionToUserId: internationalCasinoSettings.commissionToUserId || null,
//                 matchCommission: internationalCasinoSettings.matchCommission || 0,
//                 partnershipToType: internationalCasinoSettings.partnershipToType || 'miniAdmin',
//                 partnershipToUserId: internationalCasinoSettings.partnershipToUserId || null,
//                 partnership: internationalCasinoSettings.partnership || 0
//             })
//         ]);

//         // Update MiniAdmin with settings IDs
//         await miniAdminRepo.update(savedMiniAdmin.id, {
//             soccerSettingId: savedSoccerSettings.id,
//             cricketSettingId: savedCricketSettings.id,
//             tennisSettingId: savedTennisSettings.id,
//             matkaSettingId: savedMatkaSettings.id,
//             casinoSettingId: savedCasinoSettings.id,
//             internationalCasinoSettingId: savedInternationalCasinoSettings.id
//         });

//         await queryRunner.commitTransaction();

//         const { user_password: _, ...miniAdminWithoutPassword } = savedMiniAdmin;
//         const responseData = {
//             ...miniAdminWithoutPassword,
//             soccerSettings: savedSoccerSettings,
//             cricketSettings: savedCricketSettings,
//             tennisSettings: savedTennisSettings,
//             matkaSettings: savedMatkaSettings,
//             casinoSettings: savedCasinoSettings,
//             internationalCasinoSettings: savedInternationalCasinoSettings
//         };

//         return res.status(201).json({
//             success: true,
//             message: 'MiniAdmin created successfully with all settings',
//             data: responseData
//         });

//     } catch (error: any) {
//         await queryRunner.rollbackTransaction();
//         console.error('Error creating MiniAdmin:', error);

//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     } finally {
//         await queryRunner.release();
//     }
// };

export const getAllMiniAdmin = async (req: Request, res: Response) => {
    try {
        const miniAdminRepo = AppDataSource.getRepository(MiniAdmin);

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

        const [miniAdmins, total] = await miniAdminRepo.findAndCount({
            where,
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'allowedNoOfUsers', 'createdUsersCount',
                'fancyLocked', 'userLocked', 'bettingLocked',
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
            data: miniAdmins,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching miniAdmins:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


export const getMiniAdminById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const miniAdminRepo = AppDataSource.getRepository(MiniAdmin);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'miniAdmin ID is required'
            });
        }

        // First get the miniAdmin with basic info
        const miniAdmin = await miniAdminRepo.findOne({
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

        if (!miniAdmin) {
            return res.status(404).json({
                success: false,
                error: 'miniAdmin not found'
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
            miniAdmin.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: miniAdmin.soccerSettingId }
                })
                : Promise.resolve(null),

            miniAdmin.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: miniAdmin.cricketSettingId }
                })
                : Promise.resolve(null),

            miniAdmin.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: miniAdmin.tennisSettingId }
                })
                : Promise.resolve(null),

            miniAdmin.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: miniAdmin.matkaSettingId }
                })
                : Promise.resolve(null),

            miniAdmin.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: miniAdmin.casinoSettingId }
                })
                : Promise.resolve(null),

            miniAdmin.internationalCasinoSettingId
                ? AppDataSource.getRepository(InternationalCasinoSettings).findOne({
                    where: { id: miniAdmin.internationalCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...miniAdmin,
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
        console.error('Error fetching miniAdmin:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};