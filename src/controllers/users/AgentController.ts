import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Agent } from "../../entities/users/AgentUser";
import { SoccerSettings } from '../../entities/users/utils/SoccerSetting';
import { CricketSettings } from '../../entities/users/utils/CricketSetting';
import { CasinoSettings } from '../../entities/users/utils/CasinoSetting';
import { DiamondCasinoSettings } from '../../entities/users/utils/DiamondCasino';
import { MatkaSettings } from '../../entities/users/utils/MatkaSetting';
import { TennisSettings } from '../../entities/users/utils/TennisSetting';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { isUUID } from 'class-validator';
import { Between, Like } from 'typeorm';
import { Whitelist } from '../../entities/whitelist/Whitelist';

export const createAgent = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const whiteListId = req.user?.whiteListId;

        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const agentRepo = queryRunner.manager.getRepository(Agent);
        const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
        const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
        const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
        const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
        const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
        const diamondCasinoSettingsRepo = queryRunner.manager.getRepository(DiamondCasinoSettings);

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
            downLevelOccupyBalance = 0,
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
            soccerSettings = {},
            cricketSettings = {},
            tennisSettings = {},
            matkaSettings = {},
            casinoSettings = {},
            diamondCasinoSettings = {}
        } = req.body;

        // Basic validation
        if (!loginId || !user_password || !whiteListId) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'loginId, password, and whiteListId are required'
            });
        }

        // Check for existing agent
        const existingAgent = await agentRepo.findOne({ where: { loginId, whiteListId } });
        if (existingAgent) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create Agent entity
        const agentData = {
            loginId,
            user_password,
            whiteListId,
            uplineId: uplineId || null,
            groupID: groupID || null,
            transactionPassword: transactionPassword || null,
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
            __type: 'agent',
            liability,
            balance,
            profitLoss,
            freeChips,
            totalSettledAmount,
            creditRef,
            uplineSettlement,
            exposure,
            exposureLimit,
            downLevelOccupyBalance,
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
        };

        const savedAgent = await agentRepo.save(agentData);

        // Helper function to create settings
        const createSettings = async (repo: any, settingsData: any) => {
            return repo.save({
                userId: savedAgent.id,
                user__type: 'agent',
                ...settingsData
            });
        };

        // Create all settings in parallel
        const [
            savedSoccerSettings,
            savedCricketSettings,
            savedTennisSettings,
            savedMatkaSettings,
            savedCasinoSettings,
            savedDiamondCasinoSettings
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
                winningLimit: soccerSettings.winningLimit || 0,
                commissionToType: soccerSettings.commissionToType || 'agent',
                commissionToUserId: soccerSettings.commissionToUserId || null,
                matchCommission: soccerSettings.matchCommission || 0,
                partnershipToType: soccerSettings.partnershipToType || 'agent',
                partnershipToUserId: soccerSettings.partnershipToUserId || null,
                partnership: soccerSettings.partnership || 0
            }),
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
                winningLimit: cricketSettings.winningLimit || 0,
                commissionToType: cricketSettings.commissionToType || 'agent',
                commissionToUserId: cricketSettings.commissionToUserId || null,
                matchCommission: cricketSettings.matchCommission || 0,
                partnershipToType: cricketSettings.partnershipToType || 'agent',
                partnershipToUserId: cricketSettings.partnershipToUserId || null,
                partnership: cricketSettings.partnership || 0
            }),
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
                winningLimit: tennisSettings.winningLimit || 0,
                commissionToType: tennisSettings.commissionToType || 'agent',
                commissionToUserId: tennisSettings.commissionToUserId || null,
                matchCommission: tennisSettings.matchCommission || 0,
                partnershipToType: tennisSettings.partnershipToType || 'agent',
                partnershipToUserId: tennisSettings.partnershipToUserId || null,
                partnership: tennisSettings.partnership || 0
            }),
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
                winningLimit: matkaSettings.winningLimit || 0,
                commissionToType: matkaSettings.commissionToType || 'agent',
                commissionToUserId: matkaSettings.commissionToUserId || null,
                matchCommission: matkaSettings.matchCommission || 0,
                partnershipToType: matkaSettings.partnershipToType || 'agent',
                partnershipToUserId: matkaSettings.partnershipToUserId || null,
                partnership: matkaSettings.partnership || 0
            }),
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
                winningLimit: casinoSettings.winningLimit || 0,
                commissionToType: casinoSettings.commissionToType || 'agent',
                commissionToUserId: casinoSettings.commissionToUserId || null,
                matchCommission: casinoSettings.matchCommission || 0,
                partnershipToType: casinoSettings.partnershipToType || 'agent',
                partnershipToUserId: casinoSettings.partnershipToUserId || null,
                partnership: casinoSettings.partnership || 0
            }),
            createSettings(diamondCasinoSettingsRepo, {
                isWhiteListed: diamondCasinoSettings.isWhiteListed || false,
                minOddsToBet: diamondCasinoSettings.minOddsToBet || 1.01,
                maxOddsToBet: diamondCasinoSettings.maxOddsToBet || 24,
                betDelay: diamondCasinoSettings.betDelay || 1,
                minMatchStake: diamondCasinoSettings.minMatchStake || 100,
                maxMatchStake: diamondCasinoSettings.maxMatchStake || 100,
                maxProfit: diamondCasinoSettings.maxProfit || 0,
                maxLoss: diamondCasinoSettings.maxLoss || 0,
                minExposure: diamondCasinoSettings.minExposure || 0,
                maxExposure: diamondCasinoSettings.maxExposure || 0,
                winningLimit: diamondCasinoSettings.winningLimit || 0,
                commissionToType: diamondCasinoSettings.commissionToType || 'agent',
                commissionToUserId: diamondCasinoSettings.commissionToUserId || null,
                matchCommission: diamondCasinoSettings.matchCommission || 0,
                partnershipToType: diamondCasinoSettings.partnershipToType || 'agent',
                partnershipToUserId: diamondCasinoSettings.partnershipToUserId || null,
                partnership: diamondCasinoSettings.partnership || 0
            })
        ]);

        // Update Agent with settings IDs
        await agentRepo.update(savedAgent.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            diamondCasinoSettingId: savedDiamondCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...agentWithoutPassword } = savedAgent;
        const responseData = {
            ...agentWithoutPassword,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            diamondCasinoSettings: savedDiamondCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'Agent created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating Agent:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

export const getAllAgent = async (req: Request, res: Response) => {
    try {
        const agentRepo = AppDataSource.getRepository(Agent);

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

        const [agents, total] = await agentRepo.findAndCount({
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
            data: agents,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching agents:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getAgentById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const agentRepo = AppDataSource.getRepository(Agent);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'agent ID is required'
            });
        }

        // First get the agent with basic info
        const agent = await agentRepo.findOne({
            where: { id },
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'createdAt', 'updatedAt', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'allowedNoOfUsers', 'createdUsersCount',
                'fancyLocked', 'userLocked', 'bettingLocked',

                'soccerSettingId', 'cricketSettingId', 'tennisSettingId',
                'matkaSettingId', 'casinoSettingId', 'diamondCasinoSettingId',
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

        if (!agent) {
            return res.status(404).json({
                success: false,
                error: 'agent not found'
            });
        }

        // Get all related settings in parallel for better performance
        const [
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            diamondCasinoSettings
        ] = await Promise.all([
            agent.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: agent.soccerSettingId }
                })
                : Promise.resolve(null),

            agent.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: agent.cricketSettingId }
                })
                : Promise.resolve(null),

            agent.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: agent.tennisSettingId }
                })
                : Promise.resolve(null),

            agent.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: agent.matkaSettingId }
                })
                : Promise.resolve(null),

            agent.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: agent.casinoSettingId }
                })
                : Promise.resolve(null),

            agent.diamondCasinoSettingId
                ? AppDataSource.getRepository(DiamondCasinoSettings).findOne({
                    where: { id: agent.diamondCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...agent,
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            diamondCasinoSettings
        };

        return res.json({
            success: true,
            data: responseData
        });

    } catch (error: any) {
        console.error('Error fetching agent:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};