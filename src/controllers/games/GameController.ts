import { Request, Response } from "express";
import { AppDataSource } from "../../server";
import { Buttons } from "../../entities/games/Buttons";


type GameType = "casino" | "sports";

export const getButtonByUserId = async (req: Request, res: Response) => {
    const buttonsRepo = AppDataSource.getRepository(Buttons);
    try {

        const userId = req.user?.userId;

        const { gameType } = req.params;
        const gt = gameType as GameType;

        if (!userId || !gameType) {
            return res.status(400).json({
                status: false,
                message: "missing fields"
            });
        }

        const buttons = await buttonsRepo.findOne({
            where: { userId, gameType: gt }
        });

        if (!buttons) {
            return res.status(404).json({ status: false, message: "Buttons not found" });
        }

        return res.json({ status: true, data: buttons });
    } catch (err) {
        console.error("Error fetching buttons:", err);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
};

export const updateButtonByUserId = async (req: Request, res: Response) => {
    const buttonsRepo = AppDataSource.getRepository(Buttons);

    try {
        const userId = req.user?.userId;
        const { gameType } = req.params;
        const gt = gameType as GameType;
        const { labelAndValues } = req.body;

        let buttons = await buttonsRepo.findOne({
            where: { userId, gameType: gt },
        });

        if (!buttons) {
            buttons = buttonsRepo.create({ userId, gameType: gt, labelAndValues });
        } else {
            buttons.labelAndValues = labelAndValues;
        }

        const saved = await buttonsRepo.save(buttons);

        return res.json({ status: true, data: saved });
    } catch (err) {
        console.error("Error updating buttons:", err);
        return res.status(500).json({ status: false, message: "Internal server error" });
    }
};