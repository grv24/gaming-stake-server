import { Request, Response } from 'express';
import { AppDataSource } from '../../server';
import { Admin } from "../../entities/users/AdminUser";
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

export const createAdmin = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

        const uplineId = req.user?.id;

        const adminRepo = queryRunner.manager.getRepository(Admin);
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

        const existingAdmin = await adminRepo.findOne({ where: { loginId } });
        if (existingAdmin) {
            await queryRunner.rollbackTransaction();
            return res.status(409).json({
                success: false,
                error: 'loginId already exists'
            });
        }

        const adminInfo = {
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
            __type: 'admin',
            liability: liability || 0,
            balance: balance || 0,
            profitLoss: profitLoss || 0,
            freeChips: freeChips || 0,
            totalSettledAmount: totalSettledAmount || 0,
            exposure: exposure || 0,
            exposureLimit: exposureLimit || 10000000,
            whiteListAccess: whiteListAccess || false,
            depositWithdrawlAccess: depositWithdrawlAccess || false,
            canDeleteBets: canDeleteBets || false,
            canDeleteUsers: canDeleteUsers || false,
            specialPermissions: specialPermissions || false,
            enableMultipleLogin: enableMultipleLogin || false,
            autoSignUpFeature: autoSignUpFeature || false,
            displayUsersOnlineStatus: displayUsersOnlineStatus || false,
            refundOptionFeature: refundOptionFeature || false,
            canDeclareResultAsOperator: canDeclareResultAsOperator || false,
            allowedNoOfUsers: allowedNoOfUsers || 8,
            createdUsersCount: createdUsersCount || 0,
            percentageWiseCommission: percentageWiseCommission !== false,
            partnerShipWiseCommission: partnerShipWiseCommission || false,
            commissionLena: commissionLena !== false,
            commissionDena: commissionDena || false,
        };

        // Create and validate Admin
        const admin = plainToInstance(Admin, adminInfo);
        const errors = await validate(admin);
        if (errors.length > 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Admin validation failed',
                details: errors.map(e => Object.values(e.constraints || {})).flat()
            });
        }

        const savedAdmin = await adminRepo.save(admin);

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
            // Soccer Settings
            createSettings(soccerSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

            // Cricket Settings
            createSettings(cricketSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

            // Tennis Settings
            createSettings(tennisSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

            // Matka Settings
            createSettings(matkaSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

            // Casino Settings
            createSettings(casinoSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

            // Diamond Casino Settings
            createSettings(diamondCasinoSettingsRepo, {
                userId: savedAdmin.id,
                user__type: 'admin',
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

        await adminRepo.update(savedAdmin.id, {
            soccerSettingId: savedSoccerSettings.id,
            cricketSettingId: savedCricketSettings.id,
            tennisSettingId: savedTennisSettings.id,
            matkaSettingId: savedMatkaSettings.id,
            casinoSettingId: savedCasinoSettings.id,
            diamondCasinoSettingId: savedDiamondCasinoSettings.id
        });

        await queryRunner.commitTransaction();

        savedAdmin.user_password = '_';
        // const { user_password: _,...adminData } = savedAdmin;
        const responseData = {
            ...savedAdmin,
            soccerSettings: savedSoccerSettings,
            cricketSettings: savedCricketSettings,
            tennisSettings: savedTennisSettings,
            matkaSettings: savedMatkaSettings,
            casinoSettings: savedCasinoSettings,
            diamondCasinoSettings: savedDiamondCasinoSettings
        };

        return res.status(201).json({
            success: true,
            message: 'Admin created successfully with all settings',
            data: responseData
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error creating Admin:', error);

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
                'allowedNoOfUsers', 'createdUsersCount',
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
            diamondCasinoSettings
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

            admin.diamondCasinoSettingId
                ? AppDataSource.getRepository(DiamondCasinoSettings).findOne({
                    where: { id: admin.diamondCasinoSettingId }
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
            diamondCasinoSettings
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