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
      activityTracker.trackUserActivity({
        userId: req.user.userId,
        userType: req.user.__type,
        activityType,
        activityDescription: description,
        activityData: {
          endpoint: req.route?.path || req.path,
          method: req.method,
          query: req.query,
          body: req.body,
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
