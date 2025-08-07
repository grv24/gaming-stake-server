import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Client } from "../../entities/users/ClientUser";
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

export const createClient = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const clientRepo = queryRunner.manager.getRepository(Client);
        const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
        const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
        const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
        const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
        const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
        const diamondCasinoSettingsRepo = queryRunner.manager.getRepository(DiamondCasinoSettings);

        // Validate whiteListId
        if (!isUUID(req.body.whiteListId)) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid whiteListId UUID is required'
            });
        }

        const {
            loginId,
            user_password,
            whiteListId,
            uplineId,
            groupID,
            transactionPassword,
            referallCode,
            userName,
            countryCode,
            mobile,
            isAutoRegisteredUser,
            IpAddress,
            remarks,
            fancyLocked,
            bettingLocked,
            userLocked,
            whatsappNumber,
            topBarRunningMessage,
            liability,
            balance,
            profitLoss,
            freeChips,
            totalSettledAmount,
            exposure,
            exposureLimit,
            bonusAmount,
            bonusWageringRequired,
            bonusWageringProgress,
            bonusExpiresAt,
            bonusActive,
            depositWithdrawlAccess,
            canBypassCasinoBet,
            canBypassSportBet,
            casinoButtons,
            gameButtons,
            percentageWiseCommission,
            partnerShipWiseCommission,
            commissionLena,
            commissionDena,
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            diamondCasinoSettings
        } = req.body;

        if (!loginId || !user_password || !whiteListId) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'loginId, password, and whiteListId are required'
            });
        }

        const existingClient = await clientRepo.findOne({ where: { loginId } });
        if (existingClient) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        const clientData = {
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
            isAutoRegisteredUser: isAutoRegisteredUser || false,
            IpAddress: IpAddress || null,
            remarks: remarks || null,
            fancyLocked: fancyLocked || false,
            bettingLocked: bettingLocked || false,
            userLocked: userLocked || false,
            isActive: true,
            whatsappNumber: whatsappNumber || null,
            topBarRunningMessage: topBarRunningMessage || null,
            __type: 'client',
            liability: liability || 0,
            balance: balance || 0,
            profitLoss: profitLoss || 0,
            freeChips: freeChips || 0,
            totalSettledAmount: totalSettledAmount || 0,
            exposure: exposure || 0,
            exposureLimit: exposureLimit || 1000000,
            bonusAmount: bonusAmount || 0,
            bonusWageringRequired: bonusWageringRequired || 0,
            bonusWageringProgress: bonusWageringProgress || 0,
            bonusExpiresAt: bonusExpiresAt || null,
            bonusActive: bonusActive || false,
            depositWithdrawlAccess: depositWithdrawlAccess || false,
            canBypassCasinoBet: canBypassCasinoBet || false,
            canBypassSportBet: canBypassSportBet || false,
            casinoButtons: casinoButtons || {},
            gameButtons: gameButtons || {},
            percentageWiseCommission: percentageWiseCommission !== false,
            partnerShipWiseCommission: partnerShipWiseCommission || false,
            commissionLena: commissionLena !== false,
            commissionDena: commissionDena || false,
        };

        // Create and validate Client
        const client = plainToInstance(Client, clientData);
        const errors = await validate(client);
        if (errors.length > 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Client validation failed',
                details: errors.map(e => Object.values(e.constraints || {})).flat()
            });
        }

        const savedClient = await clientRepo.save(client);

        // Helper function to create and validate settings
        const createSettings = async (repo: any, settingsData: any, type: string) => {
            const settings = plainToInstance(repo.target, settingsData);
            const errors = await validate(settings);
            if (errors.length > 0) {
                throw {
                    type,
                    errors: errors.map(e => Object.values(e.constraints || {})).flat()
                };
            }
            return repo.save(settings);
        };

        const [
            savedSoccerSettings,
            savedCricketSettings,
            savedTennisSettings,
            savedMatkaSettings,
            savedCasinoSettings,
            savedDiamondCasinoSettings
        ] = await Promise.all([
            createSettings(soccerSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: soccerSettings?.isWhiteListed || false,
                minOddsToBet: soccerSettings?.minOddsToBet || 1.01,
                maxOddsToBet: soccerSettings?.maxOddsToBet || 24,
                sportId: soccerSettings?.sportId || null,
                betDelay: soccerSettings?.betDelay || 1,
                bookMakerDelay: soccerSettings?.bookMakerDelay || 1,
                minMatchStake: soccerSettings?.minMatchStake || 100,
                maxMatchStake: soccerSettings?.maxMatchStake || 100,
                minBookMakerStake: soccerSettings?.minBookMakerStake || 100,
                maxBookMakerStake: soccerSettings?.maxBookMakerStake || 1,
                maxProfit: soccerSettings?.maxProfit || 0,
                maxLoss: soccerSettings?.maxLoss || 0,
                minExposure: soccerSettings?.minExposure || 0,
                maxExposure: soccerSettings?.maxExposure || 0,
                winningLimit: soccerSettings?.winningLimit || 0
            }, 'soccer'),

            createSettings(cricketSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: cricketSettings?.isWhiteListed || false,
                min_Odds_To_Bet: cricketSettings?.min_Odds_To_Bet || 1.01,
                max_Odds_To_Bet: cricketSettings?.max_Odds_To_Bet || 24,
                sportId: cricketSettings?.sportId || null,
                betDelay: cricketSettings?.betDelay || 1,
                bookMakerDelay: cricketSettings?.bookMakerDelay || 1,
                sessionDelay: cricketSettings?.sessionDelay || 1,
                minMatchStake: cricketSettings?.minMatchStake || 100,
                maxMatchStake: cricketSettings?.maxMatchStake || 1,
                minBookMakerStake: cricketSettings?.minBookMakerStake || 100,
                maxBookMakerStake: cricketSettings?.maxBookMakerStake || 1,
                minSessionStake: cricketSettings?.minSessionStake || 100,
                maxSessionStake: cricketSettings?.maxSessionStake || 1,
                maxProfit: cricketSettings?.maxProfit || 0,
                maxLoss: cricketSettings?.maxLoss || 0,
                sessionMaxProfit: cricketSettings?.sessionMaxProfit || 0,
                sessionMaxLoss: cricketSettings?.sessionMaxLoss || 0,
                minExposure: cricketSettings?.minExposure || 0,
                maxExposure: cricketSettings?.maxExposure || 0,
                winningLimit: cricketSettings?.winningLimit || 0
            }, 'cricket'),

            createSettings(tennisSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: tennisSettings?.isWhiteListed || false,
                minOddsToBet: tennisSettings?.minOddsToBet || 1.01,
                maxOddsToBet: tennisSettings?.maxOddsToBet || 24,
                sportId: tennisSettings?.sportId || null,
                betDelay: tennisSettings?.betDelay || 1,
                bookMakerDelay: tennisSettings?.bookMakerDelay || 1,
                minMatchStake: tennisSettings?.minMatchStake || 100,
                maxMatchStake: tennisSettings?.maxMatchStake || 100,
                minBookMakerStake: tennisSettings?.minBookMakerStake || 100,
                maxBookMakerStake: tennisSettings?.maxBookMakerStake || 1,
                maxProfit: tennisSettings?.maxProfit || 0,
                maxLoss: tennisSettings?.maxLoss || 0,
                minExposure: tennisSettings?.minExposure || 0,
                maxExposure: tennisSettings?.maxExposure || 0,
                winningLimit: tennisSettings?.winningLimit || 0
            }, 'tennis'),

            createSettings(matkaSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: matkaSettings?.isWhiteListed || false,
                minOddsToBet: matkaSettings?.minOddsToBet || 1.01,
                maxOddsToBet: matkaSettings?.maxOddsToBet || 24,
                betDelay: matkaSettings?.betDelay || 1,
                minMatchStake: matkaSettings?.minMatchStake || 100,
                maxMatchStake: matkaSettings?.maxMatchStake || 100,
                maxProfit: matkaSettings?.maxProfit || 0,
                maxLoss: matkaSettings?.maxLoss || 0,
                minExposure: matkaSettings?.minExposure || 0,
                maxExposure: matkaSettings?.maxExposure || 0,
                winningLimit: matkaSettings?.winningLimit || 0
            }, 'matka'),

            createSettings(casinoSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: casinoSettings?.isWhiteListed || false,
                minOddsToBet: casinoSettings?.minOddsToBet || 1.01,
                maxOddsToBet: casinoSettings?.maxOddsToBet || 24,
                betDelay: casinoSettings?.betDelay || 1,
                minMatchStake: casinoSettings?.minMatchStake || 100,
                maxMatchStake: casinoSettings?.maxMatchStake || 100,
                maxProfit: casinoSettings?.maxProfit || 0,
                maxLoss: casinoSettings?.maxLoss || 0,
                minExposure: casinoSettings?.minExposure || 0,
                maxExposure: casinoSettings?.maxExposure || 0,
                winningLimit: casinoSettings?.winningLimit || 0
            }, 'casino'),

            createSettings(diamondCasinoSettingsRepo, {
                userId: savedClient.id,
                user__type: 'client',
                isWhiteListed: diamondCasinoSettings?.isWhiteListed || false,
                minOddsToBet: diamondCasinoSettings?.minOddsToBet || 1.01,
                maxOddsToBet: diamondCasinoSettings?.maxOddsToBet || 24,
                betDelay: diamondCasinoSettings?.betDelay || 1,
                minMatchStake: diamondCasinoSettings?.minMatchStake || 100,
                maxMatchStake: diamondCasinoSettings?.maxMatchStake || 100,
                maxProfit: diamondCasinoSettings?.maxProfit || 0,
                maxLoss: diamondCasinoSettings?.maxLoss || 0,
                minExposure: diamondCasinoSettings?.minExposure || 0,
                maxExposure: diamondCasinoSettings?.maxExposure || 0,
                winningLimit: diamondCasinoSettings?.winningLimit || 0
            }, 'diamondCasino')
        ]).catch(async (error) => {
            await queryRunner.rollbackTransaction();
            throw error;
        });

        await clientRepo.update(savedClient.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            diamondCasinoSettingId: savedDiamondCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...clientWithoutSensitiveData } = savedClient;
        const responseData = {
            ...clientWithoutSensitiveData,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            diamondCasinoSettings: savedDiamondCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'Client created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating Client:', error);

        if (error.type) {
            return res.status(400).json({
                success: false,
                error: `${error.type} settings validation failed`,
                details: error.errors
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

export const getAllClient = async (req: Request, res: Response) => {
    try {
        const clientRepo = AppDataSource.getRepository(Client);

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

        const [clients, total] = await clientRepo.findAndCount({
            where,
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'depositWithdrawlAccess',
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
            data: clients,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching clients:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getClientById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const clientRepo = AppDataSource.getRepository(Client);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'client ID is required'
            });
        }

        const client = await clientRepo.findOne({
            where: { id },
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'createdAt', 'updatedAt', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'soccerSettingId', 'cricketSettingId', 'tennisSettingId',
                'matkaSettingId', 'casinoSettingId', 'diamondCasinoSettingId',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'depositWithdrawlAccess',
                'percentageWiseCommission',
                'partnerShipWiseCommission', 'commissionLena', 'commissionDena'
            ]
        });

        if (!client) {
            return res.status(404).json({
                success: false,
                error: 'client not found'
            });
        }

        const [
            soccerSettings,
            cricketSettings,
            tennisSettings,
            matkaSettings,
            casinoSettings,
            diamondCasinoSettings
        ] = await Promise.all([
            client.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: client.soccerSettingId }
                })
                : Promise.resolve(null),

            client.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: client.cricketSettingId }
                })
                : Promise.resolve(null),

            client.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: client.tennisSettingId }
                })
                : Promise.resolve(null),

            client.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: client.matkaSettingId }
                })
                : Promise.resolve(null),

            client.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: client.casinoSettingId }
                })
                : Promise.resolve(null),

            client.diamondCasinoSettingId
                ? AppDataSource.getRepository(DiamondCasinoSettings).findOne({
                    where: { id: client.diamondCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...client,
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
        console.error('Error fetching client:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};