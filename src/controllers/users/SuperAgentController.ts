import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { SuperAgent } from "../../entities/users/SuperAgentUser";
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

export const createSuperAgent = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const whiteListId = req.user?.whiteListId;
        
        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const superAgentRepo = queryRunner.manager.getRepository(SuperAgent);
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
            exposureLimit = 1000000,
            whiteListAccess = false,
            isPanelCommission,
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

        // Check for existing super agent
        const existingSuperAgent = await superAgentRepo.findOne({ where: { loginId, whiteListId } });
        if (existingSuperAgent) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create SuperAgent entity with percentage and commission fields
        const superAgentData = {
            loginId,
            user_password,
            whiteListId,
            uplineId: uplineId || null,
            groupID: groupID || null,
            transactionPassword: generateTransactionCode(12) || "SUPERAGENT123",
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
            __type: 'superAgent',
            liability,
            isPanelCommission,
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

        const savedSuperAgent = await superAgentRepo.save(superAgentData);

        // Helper function to create settings with proper commission distribution
        const createSettings = async (repo: any, settingsData: any, sportType: string) => {
            // Calculate commission distribution based on global settings
            const commissionDistribution = {
                commissionUplineType: settingsData.commissionUplineType || 'superAgent',
                commissionUplineUserId: settingsData.commissionUplineUserId || uplineId,
                commissionUpline: settingsData.commissionUpline || commissionUpline || 0,
                commissionOwn: settingsData.commissionOwn || 100 - commissionUpline || 0,
                partnershipUplineType: settingsData.partnershipUplineType || 'superAgent',
                partnershipUplineUserId: settingsData.partnershipUplineUserId || uplineId,
                partnershipUpline: settingsData.partnershipUpline || partnershipUpline || 0,
                partnershipOwn: settingsData.partnershipOwn || 100 - partnershipUpline || 0,
            };

            return repo.save({
                userId: savedSuperAgent.id,
                user__type: 'superAgent',
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

        // Update SuperAgent with settings IDs
        await superAgentRepo.update(savedSuperAgent.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            internationalCasinoSettingId: savedInternationalCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...superAgentWithoutPassword } = savedSuperAgent;
        const responseData = {
            ...superAgentWithoutPassword,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            internationalCasinoSettings: savedInternationalCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'SuperAgent created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating SuperAgent:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

// export const createSuperAgent = async (req: Request, res: Response) => {
//     const queryRunner = AppDataSource.createQueryRunner();
//     await queryRunner.connect();
//     await queryRunner.startTransaction();

//     try {
//         const uplineId = req.user?.userId;
//         const whiteListId = req.user?.whiteListId;
        
//         const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
//         const superAgentRepo = queryRunner.manager.getRepository(SuperAgent);
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
//             exposureLimit = 1000000,
//             whiteListAccess = false,
//             isPanelCommission,
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
//              commissionToType,
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

//         // Check for existing super agent
//         const existingSuperAgent = await superAgentRepo.findOne({ where: { loginId, whiteListId } });
//         if (existingSuperAgent) {
//             await queryRunner.rollbackTransaction();
//             return res.status(409).json({
//                 success: false,
//                 error: 'loginId already exists'
//             });
//         }

//         // Create SuperAgent entity
//         const superAgentData = {
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
//             __type: 'superAgent',
//             liability,
//             isPanelCommission,
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

//         const savedSuperAgent = await superAgentRepo.save(superAgentData);

//         // Helper function to create settings
//         const createSettings = async (repo: any, settingsData: any) => {
//             return repo.save({
//                 userId: savedSuperAgent.id,
//                 user__type: 'superAgent',
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
//                 commissionToType: soccerSettings.commissionToType || 'superAgent',
//                 commissionToUserId: soccerSettings.commissionToUserId || null,
//                 matchCommission: soccerSettings.matchCommission || 0,
//                 partnershipToType: soccerSettings.partnershipToType || 'superAgent',
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
//                 commissionToType: cricketSettings.commissionToType || 'superAgent',
//                 commissionToUserId: cricketSettings.commissionToUserId || null,
//                 matchCommission: cricketSettings.matchCommission || 0,
//                 partnershipToType: cricketSettings.partnershipToType || 'superAgent',
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
//                 commissionToType: tennisSettings.commissionToType || 'superAgent',
//                 commissionToUserId: tennisSettings.commissionToUserId || null,
//                 matchCommission: tennisSettings.matchCommission || 0,
//                 partnershipToType: tennisSettings.partnershipToType || 'superAgent',
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
//                 commissionToType: matkaSettings.commissionToType || 'superAgent',
//                 commissionToUserId: matkaSettings.commissionToUserId || null,
//                 matchCommission: matkaSettings.matchCommission || 0,
//                 partnershipToType: matkaSettings.partnershipToType || 'superAgent',
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
//                 commissionToType: casinoSettings.commissionToType || 'superAgent',
//                 commissionToUserId: casinoSettings.commissionToUserId || null,
//                 matchCommission: casinoSettings.matchCommission || 0,
//                 partnershipToType: casinoSettings.partnershipToType || 'superAgent',
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
//                 commissionToType: internationalCasinoSettings.commissionToType || 'superAgent',
//                 commissionToUserId: internationalCasinoSettings.commissionToUserId || null,
//                 matchCommission: internationalCasinoSettings.matchCommission || 0,
//                 partnershipToType: internationalCasinoSettings.partnershipToType || 'superAgent',
//                 partnershipToUserId: internationalCasinoSettings.partnershipToUserId || null,
//                 partnership: internationalCasinoSettings.partnership || 0
//             })
//         ]);

//         // Update SuperAgent with settings IDs
//         await superAgentRepo.update(savedSuperAgent.id, {
//             soccerSettingId: savedSoccerSettings.id,
//             cricketSettingId: savedCricketSettings.id,
//             tennisSettingId: savedTennisSettings.id,
//             matkaSettingId: savedMatkaSettings.id,
//             casinoSettingId: savedCasinoSettings.id,
//             internationalCasinoSettingId: savedInternationalCasinoSettings.id
//         });

//         await queryRunner.commitTransaction();

//         const { user_password: _, ...superAgentWithoutPassword } = savedSuperAgent;
//         const responseData = {
//             ...superAgentWithoutPassword,
//             soccerSettings: savedSoccerSettings,
//             cricketSettings: savedCricketSettings,
//             tennisSettings: savedTennisSettings,
//             matkaSettings: savedMatkaSettings,
//             casinoSettings: savedCasinoSettings,
//             internationalCasinoSettings: savedInternationalCasinoSettings
//         };

//         return res.status(201).json({
//             success: true,
//             message: 'SuperAgent created successfully with all settings',
//             data: responseData
//         });

//     } catch (error: any) {
//         await queryRunner.rollbackTransaction();
//         console.error('Error creating SuperAgent:', error);

//         return res.status(500).json({
//             success: false,
//             error: 'Internal server error',
//             details: process.env.NODE_ENV === 'development' ? error.message : undefined
//         });
//     } finally {
//         await queryRunner.release();
//     }
// };

export const getAllSuperAgent = async (req: Request, res: Response) => {
    try {
        const superAgentRepo = AppDataSource.getRepository(SuperAgent);

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

        const [superAgents, total] = await superAgentRepo.findAndCount({
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
            data: {
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }, 
                superAgents
            },

        });

    } catch (error: any) {
        console.error('Error fetching superAgents:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getSuperAgentById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const superAgentRepo = AppDataSource.getRepository(SuperAgent);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'SuperAgent ID is required'
            });
        }

        const superAgent = await superAgentRepo.findOne({
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

        if (!superAgent) {
            return res.status(404).json({
                success: false,
                error: 'SuperAgent not found'
            });
        }

        const [
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            internationalCasinoSettings
        ] = await Promise.all([
            superAgent.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: superAgent.soccerSettingId }
                })
                : Promise.resolve(null),

            superAgent.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: superAgent.cricketSettingId }
                })
                : Promise.resolve(null),

            superAgent.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: superAgent.tennisSettingId }
                })
                : Promise.resolve(null),

            superAgent.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: superAgent.matkaSettingId }
                })
                : Promise.resolve(null),

            superAgent.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: superAgent.casinoSettingId }
                })
                : Promise.resolve(null),

            superAgent.internationalCasinoSettingId
                ? AppDataSource.getRepository(InternationalCasinoSettings).findOne({
                    where: { id: superAgent.internationalCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...superAgent,
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
        console.error('Error fetching SuperAgent:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};