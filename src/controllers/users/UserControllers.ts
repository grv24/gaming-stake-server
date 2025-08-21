import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { DOWNLINE_MAPPING } from "../../Helpers/users/Roles";
import { AccountTrasaction } from "../../entities/Transactions/AccountTransactions";
import { Whitelist } from "../../entities/whitelist/Whitelist";
import { TechAdmin } from "../../entities/users/TechAdminUser";

export const addBalance = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const uplineBalance = req.user?.AccountDetails?.Balance;
        const uplineTransactionPassword = req.user?.transactionPassword;

        if (uplineBalance === undefined) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Upline balance is required'
            });
        }

        const { userId, userType, amount, remark, transactionPassword } = req.body;

        if (!userId || !userType || amount === undefined || amount <= 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid userId, userType and positive amount are required'
            });
        }

        if (transactionPassword !== uplineTransactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Incorrect transaction password'
            });
        }

        if (amount > uplineBalance) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance'
            });
        }

        const userRepository = queryRunner.manager.getRepository(USER_TABLES[userType]);
        if (!userRepository) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Invalid userType provided'
            });
        }

        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.uplineId !== uplineId) {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                success: false,
                error: 'This is not your direct downline user'
            });
        }

        const newBalance = Number(user.balance) + Number(amount);
        user.uplineSettlement += Number(amount);

        await userRepository.update(userId, {
            balance: newBalance,
            uplineSettlement: Number(user.uplineSettlement) + Number(amount)
        });

        const uplineRepository = queryRunner.manager.getRepository(USER_TABLES[req.user?.userType]);
        await uplineRepository.update(uplineId, {
            balance: Number(uplineBalance) - Number(amount)
        });

        const transactionRepo = queryRunner.manager.getRepository(AccountTrasaction);
        const accountTransaction = transactionRepo.create({
            uplineUserId: uplineId,
            downlineUserId: userId,
            remarks: remark || "Balance added",
            type: "deposit",
            amount
        });
        await transactionRepo.save(accountTransaction);

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: 'Balance added successfully',
            data: {
                userId,
                userType,
                previousBalance: user.balance,
                addedAmount: amount,
                newBalance,
                transactionId: accountTransaction.id
            }
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error adding balance:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};


export const withdrawBalance = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const uplineBalance = req.user?.AccountDetails?.Balance;
        const uplineTransactionPassword = req.user?.transactionPassword;

        const { userId, userType, amount, remark, transactionPassword } = req.body;

        if (!userId || !userType || amount === undefined || amount <= 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid userId, userType and positive amount are required'
            });
        }

        if (transactionPassword !== uplineTransactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Incorrect transaction password'
            });
        }

        const userRepository = queryRunner.manager.getRepository(USER_TABLES[userType]);
        if (!userRepository) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Invalid userType provided'
            });
        }

        const user = await userRepository.findOne({ where: { id: userId } });
        if (!user) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        if (user.uplineId !== uplineId) {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                success: false,
                error: 'This is not your direct downline user'
            });
        }

        if (amount > (user.balance - user.exposure)) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Insufficient downline balance'
            });
        }

        // deduct from child balance
        const newDownlineBalance = (Number(user.balance) - Number(user.exposure)) - Number(amount);
        user.uplineSettlement -= Number(amount);

        await userRepository.update(userId, {
            balance: newDownlineBalance
        });

        // add to upline balance
        const uplineRepository = queryRunner.manager.getRepository(USER_TABLES[req.user?.userType]);
        const updatedUplineBalance = Number(uplineBalance) + Number(amount);
        await uplineRepository.update(uplineId, {
            balance: updatedUplineBalance
        });

        // insert into AccountTransaction table
        const transactionRepo = queryRunner.manager.getRepository(AccountTrasaction);
        const accountTransaction = transactionRepo.create({
            uplineUserId: uplineId,
            downlineUserId: userId,
            remarks: remark || "Balance withdrawn",
            type: "withdraw",
            amount
        });
        await transactionRepo.save(accountTransaction);

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: 'Balance withdrawn successfully',
            data: {
                userId,
                userType,
                previousBalance: user.balance,
                withdrawnAmount: amount,
                newBalance: newDownlineBalance,
                transactionId: accountTransaction.id
            }
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        console.error('Error withdrawing balance:', error);

        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        await queryRunner.release();
    }
};


// export const lockUserAndDownlineMultiTable = async (req: Request, res: Response) => {
//     const { userId, userType, lockValue } = req.body;

//     if (!userId || !userType) {
//         return res.status(400).json({ message: "userId and userType are required" });
//     }

//     if (!USER_TABLES[userType]) {
//         return res.status(400).json({ message: `Unknown userType: ${userType}` });
//     }

//     try {
//         type UserRole = keyof typeof DOWNLINE_MAPPING;

//         const lockRecursive = async (id: string, currentType: UserRole) => {
//             const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

//             await repo.update(id, { userLocked: lockValue });

//             const childRoles = DOWNLINE_MAPPING[currentType];
//             if (!childRoles.length) return;

//             for (const role of childRoles) {
//                 const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
//                 const children = await childRepo.find({ where: { uplineId: id }, select: ["id"] });

//                 for (const child of children) {
//                     await lockRecursive(child.id, role as UserRole);
//                 }
//             }
//         };

//         await lockRecursive(userId, userType as UserRole);

//         return res.status(200).json({
//             status: true,
//             message: `User (${userType}) and all downline users have been locked.`
//         });
//     } catch (error) {
//         console.error("Error locking users:", error);
//         return res.status(500).json({ status: false, message: "Internal server error", error });
//     }
// };


// export const lockBetAndDownlineMultiTable = async (req: Request, res: Response) => {
//     const { userId, userType, lockValue } = req.body;

//     if (!userId || !userType) {
//         return res.status(400).json({ message: "userId and userType are required" });
//     }

//     if (!USER_TABLES[userType]) {
//         return res.status(400).json({ message: `Unknown userType: ${userType}` });
//     }

//     try {
//         type UserRole = keyof typeof DOWNLINE_MAPPING;

//         const lockRecursive = async (id: string, currentType: UserRole) => {
//             const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

//             await repo.update(id, { bettingLocked: lockValue });

//             const childRoles = DOWNLINE_MAPPING[currentType];
//             if (!childRoles.length) return;

//             for (const role of childRoles) {
//                 const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
//                 const children = await childRepo.find({ where: { uplineId: id }, select: ["id"] });

//                 for (const child of children) {
//                     await lockRecursive(child.id, role as UserRole);
//                 }
//             }
//         };

//         await lockRecursive(userId, userType as UserRole);

//         return res.status(200).json({
//             status: true,
//             message: `User (${userType}) and all downline users have been locked.`
//         });
//     } catch (error) {
//         console.error("Error locking users:", error);
//         return res.status(500).json({ status: false, message: "Internal server error", error });
//     }
// };

export const lockUserOrBetAndDownlineMultiTable = async (req: Request, res: Response) => {
    const { userId, userType, userLockValue, betLockValue, transactionPassword } = req.body;

    if (!userId || !userType) {
        return res.status(400).json({ message: "userId and userType are required" });
    }

    if (!USER_TABLES[userType]) {
        return res.status(400).json({ message: `Unknown userType: ${userType}` });
    }

    if (userLockValue === undefined && betLockValue === undefined) {
        return res.status(400).json({ message: "At least one of userLockValue or betLockValue must be provided" });
    }

    const uplineTransactionPassword = req.user?.transactionPassword;

    if (transactionPassword !== uplineTransactionPassword) {
        return res.status(400).json({
            success: false,
            error: 'Incorrect transaction password'
        });
    }

    try {
        type UserRole = keyof typeof DOWNLINE_MAPPING;

        const lockRecursive = async (id: string, currentType: UserRole) => {
            const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

            const updateField: any = {};
            if (userLockValue !== undefined) {
                updateField.userLocked = userLockValue;
            }
            if (betLockValue !== undefined) {
                updateField.bettingLocked = betLockValue;
            }

            if (Object.keys(updateField).length > 0) {
                await repo.update(id, updateField);
            }

            const childRoles = DOWNLINE_MAPPING[currentType];
            if (!childRoles.length) return;

            for (const role of childRoles) {
                const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
                const children = await childRepo.find({
                    where: { uplineId: id },
                    select: ["id"],
                });

                for (const child of children) {
                    await lockRecursive(child.id, role as UserRole);
                }
            }
        };

        await lockRecursive(userId, userType as UserRole);

        return res.status(200).json({
            status: true,
            message: `User (${userType}) and all downline users have been updated.`,
            appliedLocks: {
                ...(userLockValue !== undefined && { userLocked: userLockValue }),
                ...(betLockValue !== undefined && { bettingLocked: betLockValue }),
            },
        });
    } catch (error) {
        console.error("Error locking users:", error);
        return res.status(500).json({ status: false, message: "Internal server error", error });
    }
};



export const lockFancyAndDownlineMultiTable = async (req: Request, res: Response) => {
    const { userId, userType, lockValue } = req.body;

    if (!userId || !userType) {
        return res.status(400).json({ message: "userId and userType are required" });
    }

    if (!USER_TABLES[userType]) {
        return res.status(400).json({ message: `Unknown userType: ${userType}` });
    }

    try {
        type UserRole = keyof typeof DOWNLINE_MAPPING;

        const lockRecursive = async (id: string, currentType: UserRole) => {
            const repo = AppDataSource.getRepository(USER_TABLES[currentType]);

            await repo.update(id, { fancyLocked: lockValue });

            const childRoles = DOWNLINE_MAPPING[currentType];
            if (!childRoles.length) return;

            for (const role of childRoles) {
                const childRepo = AppDataSource.getRepository(USER_TABLES[role]);
                const children = await childRepo.find({ where: { uplineId: id }, select: ["id"] });

                for (const child of children) {
                    await lockRecursive(child.id, role as UserRole);
                }
            }
        };

        await lockRecursive(userId, userType as UserRole);

        return res.status(200).json({
            status: true,
            message: `User (${userType}) and all downline users have been locked.`
        });
    } catch (error) {
        console.error("Error locking users:", error);
        return res.status(500).json({ status: false, message: "Internal server error", error });
    }
};

export const getUserIp = async (req: Request, res: Response) => {
    try {
        const ip =
            req.headers['x-forwarded-for']?.toString().split(",")[0] ||
            req.socket.remoteAddress ||
            req.ip;

        if (!ip) {
            return res.status(400).json({ status: false, message: "Unable to determine IP address" });
        }

        return res.status(200).json({
            status: true,
            ip
        });
    } catch (error) {
        console.error("Error fetching user IP:", error);
        return res.status(500).json({ status: false, message: "Internal server error", error });
    }
};

export const getAllDownlineUsers = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user?.userId;
        if (!currentUserId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const allUsers: any[] = [];

        const fetchChildren = async (parentId: string) => {
            for (const [type, entity] of Object.entries(USER_TABLES)) {
                const repo = AppDataSource.getRepository(entity);

                const children = await repo.find({
                    where: { uplineId: parentId }, relations: [
                        'soccerSettings',
                        'cricketSettings',
                        'tennisSettings',
                        'matkaSettings',
                        'casinoSettings',
                        'diamondCasinoSettings'
                    ]
                });

                for (const child of children) {
                    allUsers.push({
                        ...child,
                    });
                }
            }
        };

        await fetchChildren(currentUserId);

        return res.status(200).json({
            success: true,
            count: allUsers.length,
            users: allUsers
        });

    } catch (error) {
        console.error("Error fetching downline users:", error);
        return res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
};

export const setExposureLimitForDownline = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const uplineTransactionPassword = req.user?.transactionPassword;

        const { userId, userType, newLimit, transactionPassword } = req.body;

        if (!userId || !userType || !newLimit || !transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        const userRepository = queryRunner.manager.getRepository(USER_TABLES[userType]);
        if (!userRepository) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Invalid userType provided"
            });
        }

        const user = await userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        if (uplineTransactionPassword !== transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                success: false,
                error: "Invalid transaction password"
            });
        }

        user.exposureLimit = newLimit;
        await userRepository.save(user);

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Exposure limit updated successfully",
            data: user
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        return res.status(500).json({
            success: false,
            error: error.message || "Something went wrong"
        });
    } finally {
        await queryRunner.release();
    }
};



export const changePasswordOfDownline = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineTransactionPassword = req.user?.transactionPassword;

        const { userId, userType, newPassword, transactionPassword } = req.body;

        if (!userId || !userType || !newPassword || !transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        const userRepository = queryRunner.manager.getRepository(USER_TABLES[userType]);
        if (!userRepository) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Invalid userType provided"
            });
        }

        const user = await userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        if (uplineTransactionPassword !== transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                success: false,
                error: "Invalid transaction password"
            });
        }

        user.user_password = newPassword;
        await userRepository.save(user);

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
            data: user
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        return res.status(500).json({
            success: false,
            error: error.message || "Something went wrong"
        });
    } finally {
        await queryRunner.release();
    }
};



export const setCreditRefForDownline = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const uplineId = req.user?.userId;
        const uplineTransactionPassword = req.user?.transactionPassword;

        const { userId, userType, newCreditRef, transactionPassword } = req.body;

        if (!userId || !userType || !newCreditRef || !transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        const userRepository = queryRunner.manager.getRepository(USER_TABLES[userType]);
        if (!userRepository) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: "Invalid userType provided"
            });
        }

        const user = await userRepository.findOne({
            where: { id: userId }
        });

        if (!user) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: "User not found"
            });
        }

        if (uplineTransactionPassword !== transactionPassword) {
            await queryRunner.rollbackTransaction();
            return res.status(403).json({
                success: false,
                error: "Invalid transaction password"
            });
        }

        if (user.creditRef == newCreditRef) {

        } else if (user.creditRef < newCreditRef) {
            const diff = newCreditRef - user.creditRef;
            user.uplineSettlement -= diff;
        } else {
            const diff = user.creditRef - newCreditRef;
            user.uplineSettlement += diff;
        }

        user.creditRef = newCreditRef;
        await userRepository.save(user);

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Exposure limit updated successfully",
            data: user
        });

    } catch (error: any) {
        await queryRunner.rollbackTransaction();
        return res.status(500).json({
            success: false,
            error: error.message || "Something went wrong"
        });
    } finally {
        await queryRunner.release();
    }
};

export const getSportsAndCasinoSetting = async (req: Request, res: Response) => {
    try {
        
        const userRepository = AppDataSource.getRepository(USER_TABLES[req.user?.__type]);

        const user = await userRepository.findOne({
            where: { id: req.user?.userId },
            relations: [
                "soccerSettings",
                "cricketSettings",
                "tennisSettings",
                "matkaSettings",
                "casinoSettings",
                "diamondCasinoSettings"
            ]
        });

        if (!user) {
            return res.status(404).json({ status: false, message: "No user found for given whitelist" });
        }

        const settings = {
            soccerSettings: user.soccerSettings,
            cricketSettings: user.cricketSettings,
            tennisSettings: user.tennisSettings,
            matkaSettings: user.matkaSettings,
            casinoSettings: user.casinoSettings,
            diamondCasinoSettings: user.diamondCasinoSettings
        };

        return res.status(200).json({
            status: true,
            data: settings
        });
    } catch (error) {
        console.error("Error fetching Soccer and Casino settings:", error);
        return res.status(500).json({ status: false, message: "Internal server error", error });
    }
};
