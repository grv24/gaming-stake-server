import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { DOWNLINE_MAPPING } from "../../Helpers/users/Roles";

export const addBalance = async (req: Request, res: Response) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {

        const uplineId = req.user?.id;
        const { userId, userType, amount } = req.body;

        if (!userId || !userType || amount === undefined || amount <= 0) {
            await queryRunner.rollbackTransaction();
            return res.status(400).json({
                success: false,
                error: 'Valid userId, userType and positive amount are required'
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

        if(user.uplineId == uplineId) {
            await queryRunner.rollbackTransaction();
            return res.status(404).json({
                success: false,
                error: 'This is not your downline user'
            });
        }

        const newBalance = Number(user.balance) + Number(amount);
        await userRepository.update(userId, { balance: newBalance });

        await queryRunner.commitTransaction();

        return res.status(200).json({
            success: true,
            message: 'Balance added successfully',
            data: {
                userId,
                userType,
                previousBalance: user.balance,
                addedAmount: amount,
                newBalance
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


export const lockUserAndDownlineMultiTable = async (req: Request, res: Response) => {
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

            await repo.update(id, { userLocked: lockValue });

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
