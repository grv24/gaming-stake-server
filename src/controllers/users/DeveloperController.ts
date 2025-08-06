import { Request, Response } from 'express';
import { Developer } from '../../entities/users/DeveloperUser';
import { AppDataSource } from '../../server';
import jwt from 'jsonwebtoken';

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

export const loginDeveloper = async (req: Request, res: Response) => {
  try {
    const developerRepo = AppDataSource.getRepository(Developer);
    const { loginId, userPassword } = req.body;

    if (!loginId || !userPassword) {
      return res.status(400).json({ error: 'loginId and userPassword are required' });
    }

    const developer = await developerRepo.findOneBy({ loginId });

    if (!developer) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (developer.userPassword !== userPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!developer.isActive) {
      return res.status(403).json({ error: 'Account is not active' });
    }

    const sanitizedDeveloper = {
      id: developer.id,
      userName: developer.userName,
      loginId: developer.loginId,
      isActive: developer.isActive,
      __type: developer.__type,
      createdUsersCount: developer.createdUsersCount,
      balance: developer.balance,
      freeChips: developer.freeChips
    };

    const token = jwt.sign(
      { user: sanitizedDeveloper },
      process.env.JWT_SECRET as any,
      { expiresIn: process.env.JWT_EXPIRES_IN as any }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        token,
        developer: sanitizedDeveloper
      }
    });

  } catch (err) {
    console.error('Error logging in developer:', err);
    return res.status(500).json({ status: "error", message: "Something went wrong" });
  }
};

export const logoutDeveloper = async (req: Request, res: Response) => {
  try {
    return res.status(200).json({ 
      status: 'success', 
      message: 'Logout successful. Please remove the token on client side.' 
    });
  } catch (err) {
    console.error('Error logging out developer:', err);
    return res.status(500).json({ status: "error", message: "Something went wrong"  });
  }
};

