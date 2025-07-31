import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { retrieveUserAddress } from '../utils/ipTools';
import { validateClientLogin } from '../validators/client';
import redisClient from '../config/redis';
import { io } from '../socket';

const prisma = new PrismaClient();

export const fetchIpAddress = async (req: Request, res: Response) => {
    try {
        const ip =
            (req.headers["x-forwarded-for"] as any)?.split(",")[0]?.trim() || // support proxies
            req.socket?.remoteAddress ||                              // standard socket
            req.connection?.remoteAddress ||                          // fallback
            req.ip;                                                   // express fallback

        return res.status(200).json({ success: true, ipAddress: ip });
    } catch (error: any) {
        console.error("Error fetching IP details:", error.message);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch IP address.",
            message: error.message,
        });
    }
};


export const clientLogin = async (req: Request, res: Response) => {
  try {
    const { error } = validateClientLogin(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, error: error.details[0].message });
    }

    const { loginId, password, IpAddress, hostUrl } = req.body;

    const extractRootDomain = (url: string) => {
      try {
        const hostname = new URL(url).hostname;
        const parts = hostname.split(".");
        return parts.slice(-2).join(".");
      } catch (error) {
        return null;
      }
    };

    const rootDomain = extractRootDomain(hostUrl);
    if (!rootDomain) {
      return res.status(400).json({
        success: false,
        error: "Invalid URL format.",
      });
    }

    const cacheKey = `whitelist:${rootDomain}`;
    let whitelistId;

    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      const whiteListData = JSON.parse(cachedData);
      whitelistId = whiteListData.id;
    } else {
      const existingDoc = await prisma.whiteList.findFirst({
        where: {
          clientUrl: {
            contains: rootDomain,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      whitelistId = existingDoc?.id;
    }

    if (!whitelistId) {
      return res.status(404).json({
        success: false,
        message: "No matching whitelist data found.",
      });
    }

    const client = await prisma.user.findFirst({
      where: {
        loginId,
        whiteListId: whitelistId,
        role: 'client',
      },
      include: {
        clientDetails: true,
      },
    });

    if (!client) {
      return res.status(400).json({ success: false, error: "No Client found" });
    }

    const isMatch = await bcrypt.compare(password, client.passwordHash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid Password" });
    }

    if (client.isLocked) {
      return res.status(422).json({
        success: false,
        error: "Your Account Has Been Suspended!!!",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (IpAddress) {
        const userAddressDetails = await retrieveUserAddress(IpAddress);

        await tx.loginReport.create({
          data: {
            ip: IpAddress,
            location: userAddressDetails?.location,
            device: userAddressDetails?.device,
            userId: client.id,
          },
        });

        await tx.ipAddress.create({
          data: {
            ip: IpAddress,
            userId: client.id,
          },
        });
      }
    });

    const token = jwt.sign(
      {
        userId: client.id,
        loginId: client.loginId,
        IpAddress,
        fancyLocked: client.clientDetails?.fancyLocked,
        bettingLocked: client.clientDetails?.bettingLocked,
        userLocked: client.isLocked,
        closedAccounts: client.clientDetails?.closedAccounts,
        groupID: client.groupId,
        __type: client.type,
      },
      process.env.TOKEN_KEY,
      {
        expiresIn: process.env.JWT_EXPIRES_IN,
      }
    );

    io.sockets.emit(`leaveOldSignIn${client.id}`, {
      success: true,
      message: "New Login Detected",
    });

    res.cookie("token", token, {
      httpOnly: true,
      expiresIn: process.env.JWT_EXPIRES_IN,
    });

    return res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
