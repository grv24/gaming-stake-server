import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { USER_TABLES } from "../../Helpers/users/Roles";
import { DOWNLINE_MAPPING } from "../../Helpers/users/Roles";

export const lockUserAndDownlineMultiTable = async (req: Request, res: Response) => {
    const { userId, userType, hostedUrl } = req.body;

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

            await repo.update(id, { userLocked: true });

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

        return res.json({
            message: `User (${userType}) and all downline users have been locked.`,
            hostedUrl
        });
    } catch (error) {
        console.error("Error locking users:", error);
        return res.status(500).json({ message: "Internal server error", error });
    }
};
