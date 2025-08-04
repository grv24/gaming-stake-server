import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from "../../server";
import { Developer } from '../../entities/users/DeveloperUser'; 

interface AuthorizedRequest extends Request {
  token: any;
  profile: any;
}

export const isDeveloper = async (req: AuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res
        .status(401)
        .json({ success: false, error: "Authorization Required" });
    }

    const token = authHeader.split(" ")[1];
    const decode = jwt.verify(token, process.env.TOKEN_KEY as any);
    const developerUserRepository = AppDataSource.getRepository(Developer);

    // Find user with relations if needed
    const user = await developerUserRepository.findOne({
      where: { id: decode.userId }
    });

    if (!user) {
      return res.status(400).json({ success: false, error: "No User Found" });
    }

    // Check if user is a developer
    if (user.__type === "Developer") { // Adjust based on your role checking logic
      req.token = token;
      req.profile = user;
      return next();
    }

    return res
      .status(400)
      .json({ success: false, error: "You Are Not Developer!!!" });

  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, error: "Token has expired" });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    console.error(error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};