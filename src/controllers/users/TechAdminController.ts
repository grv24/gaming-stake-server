import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../../server';
import { TechAdmin } from "../../entities/users/TechAdminUser";
import { SoccerSettings } from '../../entities/users/utils/SoccerSetting';
import { CricketSettings } from '../../entities/users/utils/CricketSetting';
import { CasinoSettings } from '../../entities/users/utils/CasinoSetting';
import { InternationalCasinoSettings } from '../../entities/users/utils/InternationalCasino';
import { MatkaSettings } from '../../entities/users/utils/MatkaSetting';
import { TennisSettings } from '../../entities/users/utils/TennisSetting';
import { Between, Like, Transaction } from 'typeorm';
import { Whitelist } from '../../entities/whitelist/Whitelist';
import { getUserSocket } from '../../config/socketHandler';

export const createTechAdmin = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;

        const whitelistRepo = queryRunner.manager.getRepository(Whitelist);
        const techAdminRepo = queryRunner.manager.getRepository(TechAdmin);
        const soccerSettingsRepo = queryRunner.manager.getRepository(SoccerSettings);
        const cricketSettingsRepo = queryRunner.manager.getRepository(CricketSettings);
        const tennisSettingsRepo = queryRunner.manager.getRepository(TennisSettings);
        const matkaSettingsRepo = queryRunner.manager.getRepository(MatkaSettings);
        const casinoSettingsRepo = queryRunner.manager.getRepository(CasinoSettings);
        const internationalCasinoSettingsRepo = queryRunner.manager.getRepository(InternationalCasinoSettings);

        // Validate whiteListId
        const whiteListData = await whitelistRepo.findOne({ where: { TechAdminUrl: req.body.techAdminUrl } });
        if (!whiteListData) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid whiteListId UUID is required'
            });
        }

        const whiteListId = whiteListData.id;

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
            isPanelCommission,
            liability = 0,
            balance = 0,
            profitLoss = 0,
            freeChips = 0,
            totalSettledAmount = 0,
            creditRef = 0,
            uplineSettlement = 0,
            exposure = 0,
            exposureLimit = 10000000,
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
            canChangeAvailableAdminPanels = false,
            availableAdminPanels = ['Admin', 'MiniAdmin', 'SuperMaster', 'Master', 'SuperAgent', 'Agent', 'Client'],
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

        // Check for existing admin
        const existingAdmin = await techAdminRepo.findOne({ where: { loginId, whiteListId } });
        if (existingAdmin) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        // Create TechAdmin entity
        const techAdminData = {
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
            __type: 'techAdmin',
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
            canChangeAvailableAdminPanels,
            availableAdminPanels,
            allowedNoOfUsers,
            createdUsersCount,
            percentageWiseCommission,
            partnerShipWiseCommission,
            commissionLena,
            commissionDena,
            isPanelCommission,

            // Settings IDs will be added after creation
        };

        const savedTechAdmin = await techAdminRepo.save(techAdminData);

        // Helper function to create settings
        const createSettings = async (repo: any, settingsData: any) => {
            return repo.save({
                userId: savedTechAdmin.id,
                user__type: 'techAdmin',
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
                commissionToType: soccerSettings.commissionToType || 'techAdmin',
                commissionToUserId: soccerSettings.commissionToUserId || null,
                matchCommission: soccerSettings.matchCommission || 0,
                partnershipToType: soccerSettings.partnershipToType || 'techAdmin',
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
                commissionToType: cricketSettings.commissionToType || 'techAdmin',
                commissionToUserId: cricketSettings.commissionToUserId || null,
                matchCommission: cricketSettings.matchCommission || 0,
                partnershipToType: cricketSettings.partnershipToType || 'techAdmin',
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
                commissionToType: tennisSettings.commissionToType || 'techAdmin',
                commissionToUserId: tennisSettings.commissionToUserId || null,
                matchCommission: tennisSettings.matchCommission || 0,
                partnershipToType: tennisSettings.partnershipToType || 'techAdmin',
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
                commissionToType: matkaSettings.commissionToType || 'techAdmin',
                commissionToUserId: matkaSettings.commissionToUserId || null,
                matchCommission: matkaSettings.matchCommission || 0,
                partnershipToType: matkaSettings.partnershipToType || 'techAdmin',
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
                commissionToType: casinoSettings.commissionToType || 'techAdmin',
                commissionToUserId: casinoSettings.commissionToUserId || null,
                matchCommission: casinoSettings.matchCommission || 0,
                partnershipToType: casinoSettings.partnershipToType || 'techAdmin',
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
                commissionToType: internationalCasinoSettings.commissionToType || 'techAdmin',
                commissionToUserId: internationalCasinoSettings.commissionToUserId || null,
                matchCommission: internationalCasinoSettings.matchCommission || 0,
                partnershipToType: internationalCasinoSettings.partnershipToType || 'techAdmin',
                partnershipToUserId: internationalCasinoSettings.partnershipToUserId || null,
                partnership: internationalCasinoSettings.partnership || 0
            })
        ]);

        // Update TechAdmin with settings IDs
        await techAdminRepo.update(savedTechAdmin.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            internationalCasinoSettingId: savedInternationalCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        const { user_password: _, ...adminData } = savedTechAdmin;
        const responseData = {
            ...adminData,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            internationalCasinoSettings: savedInternationalCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'TechAdmin created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating TechAdmin:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};

export const getAllTechAdmin = async (req: Request, res: Response) => {
    try {
        const techAdminRepo = AppDataSource.getRepository(TechAdmin);

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

        const [techAdmins, total] = await techAdminRepo.findAndCount({
            where,
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'fancyLocked', 'userLocked', 'bettingLocked',
                'availableAdminPanels', 'allowedNoOfUsers', 'createdUsersCount',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'whiteListAccess', 'depositWithdrawlAccess',
                'canDeleteBets', 'canDeleteUsers', 'specialPermissions',
                'enableMultipleLogin', 'autoSignUpFeature', 'displayUsersOnlineStatus',
                'refundOptionFeature', 'canDeclareResultAsOperator',
                'canChangeAvailableAdminPanels', 'percentageWiseCommission',
                'partnerShipWiseCommission', 'commissionLena', 'commissionDena',
                'createdAt', 'updatedAt'
            ],
            order: { createdAt: 'DESC' },
            skip,
            take: limit
        });

        return res.json({
            success: true,
            data: techAdmins,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error: any) {
        console.error('Error fetching TechAdmins:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const getTechAdminById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const techAdminRepo = AppDataSource.getRepository(TechAdmin);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'TechAdmin ID is required'
            });
        }

        // First get the TechAdmin with basic info
        const techAdmin = await techAdminRepo.findOne({
            where: { id },
            select: [
                'id', 'userName', 'loginId', 'countryCode', 'mobile',
                'isActive', 'createdAt', 'updatedAt', 'whiteListId',
                'balance', 'exposure', 'exposureLimit', 'freeChips',
                'fancyLocked', 'userLocked', 'bettingLocked',
                'availableAdminPanels', 'allowedNoOfUsers', 'createdUsersCount',
                'soccerSettingId', 'cricketSettingId', 'tennisSettingId',
                'matkaSettingId', 'casinoSettingId', 'internationalCasinoSettingId',
                'uplineId', 'groupID', 'referallCode', 'whatsappNumber',
                'topBarRunningMessage', 'liability', 'profitLoss',
                'totalSettledAmount', 'whiteListAccess', 'depositWithdrawlAccess',
                'canDeleteBets', 'canDeleteUsers', 'specialPermissions',
                'enableMultipleLogin', 'autoSignUpFeature', 'displayUsersOnlineStatus',
                'refundOptionFeature', 'canDeclareResultAsOperator',
                'canChangeAvailableAdminPanels', 'percentageWiseCommission',
                'partnerShipWiseCommission', 'commissionLena', 'commissionDena'
            ]
        });

        if (!techAdmin) {
            return res.status(404).json({
                success: false,
                error: 'TechAdmin not found'
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
            techAdmin.soccerSettingId
                ? AppDataSource.getRepository(SoccerSettings).findOne({
                    where: { id: techAdmin.soccerSettingId }
                })
                : Promise.resolve(null),

            techAdmin.cricketSettingId
                ? AppDataSource.getRepository(CricketSettings).findOne({
                    where: { id: techAdmin.cricketSettingId }
                })
                : Promise.resolve(null),

            techAdmin.tennisSettingId
                ? AppDataSource.getRepository(TennisSettings).findOne({
                    where: { id: techAdmin.tennisSettingId }
                })
                : Promise.resolve(null),

            techAdmin.matkaSettingId
                ? AppDataSource.getRepository(MatkaSettings).findOne({
                    where: { id: techAdmin.matkaSettingId }
                })
                : Promise.resolve(null),

            techAdmin.casinoSettingId
                ? AppDataSource.getRepository(CasinoSettings).findOne({
                    where: { id: techAdmin.casinoSettingId }
                })
                : Promise.resolve(null),

            techAdmin.internationalCasinoSettingId
                ? AppDataSource.getRepository(InternationalCasinoSettings).findOne({
                    where: { id: techAdmin.internationalCasinoSettingId }
                })
                : Promise.resolve(null)
        ]);

        const responseData = {
            ...techAdmin,
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
        console.error('Error fetching TechAdmin:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const techAdminLogin = async (req: Request, res: Response) => {
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
            where: { TechAdminUrl: hostUrl }
        });

        if (!whiteList) {
            return res.status(403).json({
                success: false,
                error: 'Access denied - URL not authorized for TechAdmin access'
            });
        }

        const techAdminRepo = AppDataSource.getRepository(TechAdmin);
        const techAdmin = await techAdminRepo.findOne({
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
        if (!techAdmin) {
            return res.status(401).json({
                success: false,
                error: 'Invalid TechAdmin credentials'
            });
        }

        if (techAdmin.userLocked) {
            return res.status(403).json({
                success: false,
                error: 'TechAdmin account is not active'
            });
        }

        if (password !== techAdmin.user_password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid TechAdmin credentials'
            });
        }

        // const { user_password, ...safeUserData } = techAdmin;

        const token = jwt.sign(
            {
                user: {
                    userId: techAdmin.id,
                    PersonalDetails: {
                        userName: techAdmin.userName,
                        loginId: techAdmin.loginId,
                        user_password: techAdmin.user_password,
                        countryCode: techAdmin.countryCode,
                        mobile: techAdmin.mobile,
                        idIsActive: techAdmin.isActive,
                        isAutoRegisteredUser: techAdmin.isAutoRegisteredUser
                    },
                    transactionPassword: techAdmin.transactionPassword,
                    whiteListId: techAdmin.whiteListId,
                    IpAddress: techAdmin.IpAddress,
                    uplineId: techAdmin.uplineId,
                    fancyLocked: techAdmin.fancyLocked,
                    bettingLocked: techAdmin.bettingLocked,
                    userLocked: techAdmin.userLocked,
                    // closedAccounts: techAdmin,
                    __type: techAdmin.__type,
                    remarks: techAdmin.remarks,
                    // featureAccessPermissions: techAdmin,
                    AccountDetails: {
                        liability: techAdmin.liability,
                        Balance: techAdmin.balance,
                        profitLoss: techAdmin.profitLoss,
                        freeChips: techAdmin.freeChips,
                        totalSettledAmount: techAdmin.totalSettledAmount,
                        Exposure: techAdmin.exposure,
                        ExposureLimit: techAdmin.exposureLimit,
                    },
                    allowedNoOfUsers: techAdmin.allowedNoOfUsers,
                    createdUsersCount: techAdmin.createdUsersCount,
                    // commissionSettings: techAdmin.commissionSettings,
                    commissionLenaYaDena: {
                        commissionLena: techAdmin.commissionLena,
                        commissionDena: techAdmin.commissionDena,
                    },
                    groupID: techAdmin.groupID,
                    createdAt: techAdmin.createdAt,
                    updatedAt: techAdmin.updatedAt,
                },
                permissions: {
                    canDeleteUsers: techAdmin.canDeleteUsers,
                    canDeleteBets: techAdmin.canDeleteBets,
                    specialPermissions: techAdmin.specialPermissions,
                    adminPanels: techAdmin.availableAdminPanels
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
            const existingSocket = getUserSocket(io, techAdmin.id);

            if (existingSocket) {
                existingSocket.emit('forceLogout', {
                    reason: 'DUPLICATE_LOGIN',
                    message: 'Logged in from new device',
                    timestamp: new Date().toISOString()
                });
                existingSocket.disconnect(true);
            }

            io.to('techAdmins').emit('adminLogin', {
                adminId: techAdmin.id,
                username: techAdmin.loginId,
                ip: userIp,
                timestamp: new Date().toISOString()
            });

            console.log(`TechAdmin ${techAdmin.id} logged in from IP: ${userIp}`);
        }

        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 12 * 60 * 60 * 1000
        });

        res.status(200).json({
            status: true,
            message: "techAdmin user data",
            data: {
                token,
                // user: safeUserData,
                socketRequired: true
            }
        });

    } catch (error) {
        console.error('TechAdmin login error:', error);

        const errorMessage = process.env.NODE_ENV === 'development'
            ? error instanceof Error ? error.message : 'Unknown error'
            : 'Internal server error';

        res.status(500).json({
            status: false,
            message: "something went wrong"
        });
    }
};

export const changeOwnPassword = async (req: Request, res: Response) => {

    try {
        
        const { currentPassword, newPassword } = req.body;
        const user = req.user;

        console.log(user);

        const techAdminRepo = AppDataSource.getRepository(TechAdmin);

        const techAdminUser = await techAdminRepo.findOne({ where: { id: req.user?.userId } });
        console.log(techAdminUser);
        if (!techAdminUser) {
            return res.status(400).json({
                success: false,
                error: 'User not found'
            })
        }

        if (techAdminUser?.user_password !== currentPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password does not match'
            })
        }

        techAdminUser.isActive = true;
        techAdminUser.user_password = newPassword;

        await techAdminRepo.save(techAdminUser);

        res.status(200).json({
            status: true,
            message: "User is now active",
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