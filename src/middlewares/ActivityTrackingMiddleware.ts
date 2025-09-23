import { Request, Response, NextFunction } from 'express';
import { activityTracker } from '../services/ActivityTrackingService';

// Middleware to track API performance
export const trackApiPerformance = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    activityTracker.trackPerformanceMetric({
      metricType: 'api_response_time',
      endpoint: req.route?.path || req.path,
      method: req.method,
      statusCode: res.statusCode,
      value: duration,
      unit: 'ms',
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || '',
        userId: req.user?.userId,
        userType: req.user?.__type,
      },
      groupId: req.user?.groupId,
    });
  });
  
  next();
};

// Middleware to track user activities
export const trackUserActivity = (activityType: string, description: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.userId) {
      // Create dynamic description with user information
      const userName = req.user.loginId || req.user.userName || req.user.name || 'Unknown User';
      const userType = req.user.__type;
      const dynamicDescription = `${description} by ${userName} (${userType})`;
      
      activityTracker.trackUserActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        activityType,
        activityDescription: dynamicDescription,
        activityData: {
          endpoint: req.route?.path || req.path,
          method: req.method,
          query: req.query,
          body: req.body,
          performedBy: userName,
          performedByType: userType,
        },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'],
        sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
        groupId: req.user.groupId,
      });
    }
    next();
  };
};

// Special middleware for password change activities
export const trackPasswordChangeActivity = (description: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.userId) {
      const originalJson = res.json;
      
      res.json = function(data: any) {
        // Track password change activity after successful response
        if (data.success && req.user?.userId) {
          const performerName = req.user.loginId || req.user.userName || req.user.name || 'Unknown User';
          const performerType = req.user.__type;
          
          // Check if this is changing another user's password
          const targetUserId = req.body.userId;
          const targetUserType = req.body.userType;
          
          let dynamicDescription: string;
          let activityData: any = {
            endpoint: req.route?.path || req.path,
            method: req.method,
            performedBy: performerName,
            performedByType: performerType,
            timestamp: new Date(),
          };
          
          if (targetUserId && targetUserId !== req.user.userId) {
            // Changing another user's password
            dynamicDescription = `${description} for user ${targetUserId} (${targetUserType}) by ${performerName} (${performerType})`;
            activityData.targetUserId = targetUserId;
            activityData.targetUserType = targetUserType;
            activityData.actionType = 'change_other_password';
          } else {
            // Changing own password
            dynamicDescription = `${description} by ${performerName} (${performerType})`;
            activityData.actionType = 'change_own_password';
          }
          
          activityTracker.trackUserActivity({
            userId: req.user.userId,
            userType: req.user.__type,
            activityType: 'password_change',
            activityDescription: dynamicDescription,
            activityData,
            ipAddress: req.ip || '',
            userAgent: req.headers['user-agent'],
            sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
            groupId: req.user.groupId,
          });
        }
        
        return originalJson.call(this, data);
      };
    }
    next();
  };
};

// Middleware to track login activities
export const trackLoginActivity = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Track login activity after successful response
    if (data.success && req.user?.userId) {
      activityTracker.trackUserActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        activityType: 'login',
        activityDescription: 'User logged in successfully',
        activityData: {
          loginId: req.body.loginId,
          hostUrl: req.body.hostUrl,
          loginTime: new Date(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'],
        sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
        groupId: req.user.groupId,
      });

      // Track session activity
      activityTracker.trackSessionActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'],
        loginTime: new Date(),
        isActive: true,
        groupId: req.user.groupId,
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Middleware to track betting activities
export const trackBettingActivity = (betType: 'sports' | 'casino') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Track bet placement after successful response
      if (data.success && req.user?.userId && req.body.stakeAmount) {
        activityTracker.trackBetActivity({
          userId: req.user.userId,
          userType: req.user.__type,
          betType,
          eventId: req.body.eventId || req.body.matchId,
          stakeAmount: req.body.stakeAmount,
          potentialWin: req.body.potentialWin,
          status: 'placed',
          betDetails: {
            betData: req.body.betData,
            odds: req.body.odds,
            marketType: req.body.marketType,
          },
          ipAddress: req.ip || '',
          userAgent: req.get('User-Agent') || '',
          groupId: req.user.groupId,
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Middleware to track balance changes
export const trackBalanceActivity = (activityType: 'deposit' | 'withdraw') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Track balance activity after successful response
      if (data.success && req.user?.userId && req.body.amount) {
        activityTracker.trackUserActivity({
          userId: req.user.userId,
          userType: req.user.__type,
          activityType,
          activityDescription: `${activityType} transaction processed`,
          activityData: {
            amount: req.body.amount,
            balanceBefore: req.body.balanceBefore,
            balanceAfter: req.body.balanceAfter,
            remarks: req.body.remarks,
            transactionId: data.transactionId,
          },
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'],
          sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
          groupId: req.user.groupId,
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Middleware to track logout activities
export const trackLogoutActivity = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    // Track logout activity
    if (req.user?.userId) {
      activityTracker.trackUserActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        activityType: 'logout',
        activityDescription: 'User logged out',
        activityData: {
          logoutTime: new Date(),
        },
        ipAddress: req.ip || '',
        userAgent: req.headers['user-agent'],
        sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
        groupId: req.user.groupId,
      });

      // Update session activity
      activityTracker.trackSessionActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        sessionId: (req as any).session?.id || req.headers['x-session-id'] as string || '',
        ipAddress: req.ip || '',
        logoutTime: new Date(),
        isActive: false,
        groupId: req.user.groupId,
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

