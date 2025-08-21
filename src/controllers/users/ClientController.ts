import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../server';
import { Client } from "../../entities/users/ClientUser";
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
import { getUserSocket } from '../../config/socketHandler';

export const createClient = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const whiteListId = req.user?.whiteListId;

        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const clientRepo = queryRunner.manager.getRepository(Client);
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
            bonusAmount = 0,
            isPanelCommission,
            bonusWageringRequired = 0,
            bonusWageringProgress = 0,
            bonusExpiresAt = null,
            bonusActive = false,
            depositWithdrawlAccess = false,
            canBypassCasinoBet = false,
            canBypassSportBet = false,
            casinoButtons = {},
            gameButtons = {},
            percentageWiseCommission = true,
            partnerShipWiseCommission = false,
            commissionLena = true,
            commissionDena = false,
            commissionToType,
            matchCommission,
            partnershipToType,
            partnership,
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

        // Check for existing client
        const existingClient = await clientRepo.findOne({ where: { loginId, whiteListId } });
        if (existingClient) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create Client entity
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
            isAutoRegisteredUser,
            IpAddress: IpAddress || null,
            remarks: remarks || null,
            fancyLocked,
            bettingLocked,
            userLocked,
            isActive: false,
            whatsappNumber: whatsappNumber || null,
            topBarRunningMessage: topBarRunningMessage || null,
            __type: 'client',
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
            commissionToType,
            commissionToUserId: uplineId,
            matchCommission,
            partnershipToType,
            partnershipToUserId: uplineId,
            partnership,
        };

        const savedClient = await clientRepo.save(clientData);

        // Helper function to create settings
        const createSettings = async (repo: any, settingsData: any) => {
            return repo.save({
                userId: savedClient.id,
                user__type: 'client',
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
                winningLimit: soccerSettings.winningLimit || 0,
                commissionToType: soccerSettings.commissionToType || 'client',
                commissionToUserId: soccerSettings.commissionToUserId || null,
                matchCommission: soccerSettings.matchCommission || 0,
                partnershipToType: soccerSettings.partnershipToType || 'client',
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
                commissionToType: cricketSettings.commissionToType || 'client',
                commissionToUserId: cricketSettings.commissionToUserId || null,
                matchCommission: cricketSettings.matchCommission || 0,
                partnershipToType: cricketSettings.partnershipToType || 'client',
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
                commissionToType: tennisSettings.commissionToType || 'client',
                commissionToUserId: tennisSettings.commissionToUserId || null,
                matchCommission: tennisSettings.matchCommission || 0,
                partnershipToType: tennisSettings.partnershipToType || 'client',
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
                commissionToType: matkaSettings.commissionToType || 'client',
                commissionToUserId: matkaSettings.commissionToUserId || null,
                matchCommission: matkaSettings.matchCommission || 0,
                partnershipToType: matkaSettings.partnershipToType || 'client',
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
                commissionToType: casinoSettings.commissionToType || 'client',
                commissionToUserId: casinoSettings.commissionToUserId || null,
                matchCommission: casinoSettings.matchCommission || 0,
                partnershipToType: casinoSettings.partnershipToType || 'client',
                partnershipToUserId: casinoSettings.partnershipToUserId || null,
                partnership: casinoSettings.partnership || 0
            }),
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
                winningLimit: internationalCasinoSettings.winningLimit || 0,
                commissionToType: internationalCasinoSettings.commissionToType || 'client',
                commissionToUserId: internationalCasinoSettings.commissionToUserId || null,
                matchCommission: internationalCasinoSettings.matchCommission || 0,
                partnershipToType: internationalCasinoSettings.partnershipToType || 'client',
                partnershipToUserId: internationalCasinoSettings.partnershipToUserId || null,
                partnership: internationalCasinoSettings.partnership || 0
            })
        ]);

        // Update Client with settings IDs
        await clientRepo.update(savedClient.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            internationalCasinoSettingId: savedInternationalCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...clientWithoutPassword } = savedClient;
        const responseData = {
            ...clientWithoutPassword,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            internationalCasinoSettings: savedInternationalCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'Client created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating Client:', error);

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
                'fancyLocked', 'userLocked', 'bettingLocked',
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
                'fancyLocked', 'userLocked', 'bettingLocked',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'soccerSettingId', 'cricketSettingId', 'tennisSettingId',
                'matkaSettingId', 'casinoSettingId', 'internationalCasinoSettingId',
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
            internationalCasinoSettings
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

            client.internationalCasinoSettingId
                ? AppDataSource.getRepository(InternationalCasinoSettings).findOne({
                    where: { id: client.internationalCasinoSettingId }
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
            internationalCasinoSettings
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

export const clientLogin = async (req: Request, res: Response) => {
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
            where: { ClientUrl: hostUrl }
        });

        if (!whiteList) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - URL not authorized for Client access'
            });
        }

        const clientRepo = AppDataSource.getRepository(Client);
        const client = await clientRepo.findOne({
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

        // Authentication checks
        if (!client) {
            return res.status(401).json({
                success: false,
                error: 'Invalid Client credentials'
            });
        }

        if (client.userLocked) {
            return res.status(403).json({
                success: false,
                error: 'Client account is not active'
            });
        }

        if (password !== client.user_password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid Client credentials'
            });
        }

        const { user_password, ...safeUserData } = client;

        const token = jwt.sign(
            {
                user: {
                    userId: client.id,
                    PersonalDetails: {
                        userName: client.userName,
                        loginId: client.loginId,
                        user_password: client.user_password,
                        countryCode: client.countryCode,
                        mobile: client.mobile,
                        idIsActive: client.isActive,
                        isAutoRegisteredUser: client.isAutoRegisteredUser
                    },
                    IpAddress: client.IpAddress,
                    transactionPassword: client.transactionPassword,
                    uplineId: client.uplineId,
                    whiteListId: client.whiteListId,
                    fancyLocked: client.fancyLocked,
                    bettingLocked: client.bettingLocked,
                    userLocked: client.userLocked,
                    // closedAccounts: user,
                    __type: client.__type,
                    remarks: client.remarks,
                    // featureAccessPermissions: user,
                    AccountDetails: {
                        liability: client.liability,
                        Balance: client.balance,
                        profitLoss: client.profitLoss,
                        freeChips: client.freeChips,
                        totalSettledAmount: client.totalSettledAmount,
                        Exposure: client.exposure,
                        ExposureLimit: client.exposureLimit,
                    },
                    allowedNoOfUsers: null,
                    createdUsersCount: null,
                    commissionSettings: {
                        commissionToType: client.commissionToType,
                        commissionToUserId: client.commissionToUserId,
                        matchCommission: client.matchCommission,
                        partnershipToType: client.partnershipToType,
                        partnershipToUserId: client.partnershipToUserId,
                        partnership: client.partnership
                    },
                    commissionLenaYaDena: {
                        commissionLena: client.commissionLena,
                        commissionDena: client.commissionDena,
                    },
                    groupID: client.groupID,
                    createdAt: client.createdAt,
                    updatedAt: client.updatedAt,

                },
                permissions: {
                    canBet: !client.bettingLocked,
                    canWithdraw: client.depositWithdrawlAccess,
                    bypassRestrictions: client.canBypassCasinoBet || client.canBypassSportBet
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
            const existingSocket = getUserSocket(io, client.id);

            if (existingSocket) {
                existingSocket.emit('forceLogout', {
                    reason: 'DUPLICATE_LOGIN',
                    message: 'Logged in from new device',
                    timestamp: new Date().toISOString()
                });
                existingSocket.disconnect(true);
            }

            io.to('clients').emit('clientLogin', {
                clientId: client.id,
                username: client.loginId,
                ip: userIp,
                timestamp: new Date().toISOString()
            });
        }

        res.cookie('clientToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 12 * 60 * 60 * 1000
        });

        res.status(200).json({
            status: true,
            message: "Client login successful",
            data: {
                token,
                // user: safeUserData,
                socketRequired: true
            }
        });

    } catch (error) {
        console.error('Client login error:', error);

        const errorMessage = process.env.NODE_ENV === 'development'
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'Internal server error';

        res.status(500).json({
            status: false,
            message: errorMessage
        });
    }
};


export const changeOwnPassword = async (req: Request, res: Response) => {

    try {

        const { currentPassword, newPassword } = req.body;

        const clientRepo = AppDataSource.getRepository(Client);

        const clientUser = await clientRepo.findOne({ where: { id: req.user?.userId } });

        if (!clientUser) {
            return res.status(400).json({
                success: false,
                error: 'User not found'
            })
        }

        if (clientUser?.user_password !== currentPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password does not match'
            })
        }


        const transactionCode = Math.floor(10000000 + Math.random() * 90000000).toString();
        clientUser.transactionPassword = transactionCode;

        clientUser.isActive = true;
        clientUser.user_password = newPassword;
        
        await clientRepo.save(clientUser);

        return res.status(200).json({
            success: true,
            message: 'User is now active',
            data: {
                transactionPassword: transactionCode
            }
        });

    } catch (error: any) {
        console.error('Error changing own password:', error);

        const errorMessage = process.env.NODE_ENV === 'development'
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'Internal server error';

        res.status(500).json({
            status: false,
            message: "something went wrong"
        });
    }

}