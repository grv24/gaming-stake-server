import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ROLE_HIERARCHY, Role } from '../Constants/Roles';

declare global {
    namespace Express {
        interface Request {
            user?: any;
            token?: string;
        }
    }
}

const roleAuth = (requiredRole: Role) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {

            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({
                    success: false,
                    error: "Authorization token required (Bearer token)"
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key') as { 
                user: {
                    id: string;
                    __type: Role;
                    isActive: boolean;
                } 
            };

            if (!decoded.user?.isActive) {
                return res.status(403).json({
                    success: false,
                    error: "Account is not active"
                });
            }

            const userRole = decoded.user.__type;
            
            const normalizedUserRole = userRole.toLowerCase() as Role;
            
            const userLevel = ROLE_HIERARCHY[normalizedUserRole];
            const requiredLevel = ROLE_HIERARCHY[requiredRole];

            if (userLevel === undefined) {
                return res.status(403).json({
                    success: false,
                    error: "Invalid user role"
                });
            }

            if (userLevel < requiredLevel) {
                return res.status(403).json({
                    success: false,
                    error: `Insufficient permissions. Required role: ${requiredRole} or higher`
                });
            }

            req.user = decoded.user;
            req.token = token;

            next();
        } catch (error: any) {
            if (error.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    error: "Token has expired"
                });
            }

            if (error.name === "JsonWebTokenError") {
                return res.status(401).json({
                    success: false,
                    error: "Invalid token"
                });
            }

            console.error('Role authentication error:', error);
            return res.status(500).json({
                success: false,
                error: "Internal server error during authentication"
            });
        }
    };
};

export const developerAuth = roleAuth('developer');
export const techAdminAndAboveAuth = roleAuth('techAdmin');
export const adminAndAboveAuth = roleAuth('admin');
export const miniAdminAndAboveAuth = roleAuth('miniAdmin');
export const superMasterAndAboveAuth = roleAuth('superMaster');
export const masterAndAboveAuth = roleAuth('master');
export const superAgentAndAboveAuth = roleAuth('superAgent');
export const agentAndAboveAuth = roleAuth('agent');
export const clientAuth = roleAuth('client');