import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ROLE_HIERARCHY, Role } from '../Helpers/users/Roles';

declare global {
    namespace Express {
        interface Request {
            user?: any;
            token?: string;
            __type?: string;
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
                    error: "token required for authorization"
                });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'idwbdiwdwndowdnowdihwidhiwhdiwhdiwhdiwhdiwhdiwhd') as { 
                userId?: string;
                userType?: string;
                user: {
                    id: string;
                    __type: Role;
                    isActive: boolean;
                } 
            };

            // if (!decoded.user?.isActive) {
            //     return res.status(403).json({
            //         success: false,
            //         error: "Account is not active"
            //     });
            // }

            const userRole = decoded.user.__type;
            
            const normalizedUserRole = userRole as Role;

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

            req.user = {
                userId: decoded.userId || decoded.user.id,
                userType: decoded.userType || decoded.user.__type,
                ...decoded.user
            };
            req.token = token;
            req.__type = decoded.user.__type;

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

// Custom middleware for gateway management with permission check
export const gatewayManagementAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // First check if user is agent level or above
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: "token required for authorization"
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'idwbdiwdwndowdnowdihwidhiwhdiwhdiwhdiwhdiwhdiwhd') as { 
            userId?: string;
            userType?: string;
            user: {
                id: string;
                __type: Role;
                isActive: boolean;
            } 
        };

        const userRole = decoded.user.__type;
        const normalizedUserRole = userRole as Role;
        const userLevel = ROLE_HIERARCHY[normalizedUserRole];
        
        // Check if user is agent level or above (level 2+)
        if (userLevel === undefined || userLevel < 2) {
            return res.status(403).json({
                success: false,
                error: "Insufficient permissions. Required role: agent or higher"
            });
        }

        // Set user info
        req.user = {
            userId: decoded.userId || decoded.user.id,
            userType: decoded.userType || decoded.user.__type,
            ...decoded.user
        };
        req.token = token;
        req.__type = decoded.user.__type;

        // Now check if user has canManageGateway permission
        const userId = req.user.userId;
        const userType = req.user.userType;

        // Import the permission check function
        const { checkPaymentGatewayPermission } = await import('../controllers/payment/PaymentGatewayController');
        
        const hasPermission = await checkPaymentGatewayPermission(userId, userType, 'canManageGateway');
        
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: "You do not have permission to manage payment gateways"
            });
        }

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

        console.error('Gateway management authentication error:', error);
        return res.status(500).json({
            success: false,
            error: "Internal server error during authentication"
        });
    }
};