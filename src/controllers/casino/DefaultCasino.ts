import { Request, Response } from "express";
import { DefaultCasino } from "../../entities/casino/DefaultCasino";
import { AppDataSource } from "../../server";

const casinoRepository = AppDataSource.getRepository(DefaultCasino);

export const createCasino = async (req: Request, res: Response) => {
    try {
        const casino = casinoRepository.create(req.body);
        const savedCasino = await casinoRepository.save(casino);
        return res.status(201).json({ status: true, data: savedCasino });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error creating casino", error: err });
    }
};

export const getAllCasinos = async (req: Request, res: Response) => {
    try {
        const casinos = await casinoRepository.find();
        return res.status(200).json({ status: true, data: casinos });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error fetching casinos", error: err });
    }
};

export const getCasinoById = async (req: Request, res: Response) => {
    try {
        const casino = await casinoRepository.findOne({ where: { id: req.params.id } });
        if (!casino) return res.status(404).json({ status: false, message: "Casino not found" });
        return res.status(200).json({ status: true, data: casino });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error fetching casino", error: err });
    }
};

export const updateCasino = async (req: Request, res: Response) => {
    try {
        const casino = await casinoRepository.findOne({ where: { id: req.params.id } });
        if (!casino) return res.status(404).json({ status: false, message: "Casino not found" });

        casinoRepository.merge(casino, req.body);
        const updated = await casinoRepository.save(casino);
        return res.status(200).json({ status: true, data: updated });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error updating casino", error: err });
    }
};

export const deleteCasino = async (req: Request, res: Response) => {
    try {
        const result = await casinoRepository.delete(req.params.id);
        if (result.affected === 0) {
            return res.status(404).json({ status: false, message: "Casino not found" });
        }
        return res.status(200).json({ status: true, message: "Casino deleted successfully" });
    } catch (err) {
        return res.status(500).json({ status: false, message: "Error deleting casino", error: err });
    }
};
