import { Request, Response } from 'express';
import prisma from '../utils/prismaClient';

export const getUsers = async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany();
  res.json(users);
};
