import { Request, Response } from 'express';
import { Developer } from '../../entities/users/DeveloperUser';
import { AppDataSource } from '../../server';

export const createDeveloper = async (req: Request, res: Response) => {
  try {
    const developerRepo = AppDataSource.getRepository(Developer);

    const {
      userName,
      loginId,
      // salt,
      userPassword,
      // encry_password,
      isActive,
      __type,
      createdUsersCount,
      balance,
      freeChips
    } = req.body;

    if (!loginId || typeof loginId !== 'string' || loginId.trim().length === 0) {
      return res.status(400).json({ error: 'Valid loginId is required' });
    }

    const existing = await developerRepo.findOneBy({ loginId });
    if (existing) {
      return res.status(409).json({ error: 'loginId already exists' });
    }

    if (userName && userName.length > 32) {
      return res.status(400).json({ error: 'userName must not exceed 32 characters' });
    }

    if (balance < 0 || freeChips < 0) {
      return res.status(400).json({ error: 'balance and freeChips cannot be negative' });
    }


    const newDeveloper = developerRepo.create({
      userName,
      loginId,
      // salt,
      userPassword,
      // encry_password,
      isActive,
      __type,
      createdUsersCount,
      balance,
      freeChips
    });

    await developerRepo.save(newDeveloper);
    return res.status(201).json({ message: 'Developer created successfully', developer: newDeveloper });
  } catch (err) {
    console.error('Error creating developer:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getDevelopers = async (req: Request, res: Response) => {
  try {
    const developerRepo = AppDataSource.getRepository(Developer);
    const { id } = req.params;

    var developers;
    if (id) {
      developers = await developerRepo.findOneBy({ id });
    } else {
      developers = await developerRepo.find();
    }

    if (!developers) {
      return res.status(204).json({ status: "success", message: 'Developers not found' });
    }

    return res.status(200).json({ status: "success", message: "Developers fetched successfully", data: { developers } });
  } catch (err) {
    console.error('Error fetching developer:', err);
    return res.status(500).json({ status: "error", message: 'Internal Server Error' });
  }
};

