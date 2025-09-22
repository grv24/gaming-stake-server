import { Request, Response } from 'express';
import { activityTracker } from '../../services/ActivityTrackingService';
import { AppDataSource } from '../../server';
import { UserActivity, BetActivity, SessionActivity, PerformanceMetric } from '../../entities/activity/ActivityEntities';

// Get user activity history
export const getUserActivityHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = 50, offset = 0, activityType } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const activities = await activityTracker.getUserActivityHistory(
      userId,
      Number(limit),
      Number(offset)
    );

    // Filter by activity type if specified
    const filteredActivities = activityType 
      ? activities.filter((a: UserActivity) => a.activityType === activityType)
      : activities;

    return res.status(200).json({
      success: true,
      data: filteredActivities,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: filteredActivities.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching user activity history:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get betting activity history
export const getBettingActivityHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = 50, offset = 0, betType } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const activities = await activityTracker.getBettingActivityHistory(
      userId,
      betType as 'sports' | 'casino' | undefined,
      Number(limit),
      Number(offset)
    );

    return res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: activities.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching betting activity history:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get session statistics
export const getSessionStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const stats = await activityTracker.getSessionStatistics(
      userId,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error: any) {
    console.error('Error fetching session statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get performance metrics (Admin only)
export const getPerformanceMetrics = async (req: Request, res: Response) => {
  try {
    const { metricType, startDate, endDate, limit = 1000 } = req.query;

    const metrics = await activityTracker.getPerformanceMetrics(
      metricType as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );

    // Limit results
    const limitedMetrics = metrics.slice(0, Number(limit));

    return res.status(200).json({
      success: true,
      data: limitedMetrics,
      pagination: {
        limit: Number(limit),
        total: metrics.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching performance metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get activity analytics dashboard
export const getActivityAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get various activity statistics
    const [
      userActivities,
      betActivities,
      sessionStats,
      performanceMetrics
    ] = await Promise.all([
      // User activities
      AppDataSource.getRepository(UserActivity).find({
        where: {
          userId,
          createdAt: { $gte: start, $lte: end } as any
        }
      }),
      
      // Bet activities
      AppDataSource.getRepository(BetActivity).find({
        where: {
          userId,
          createdAt: { $gte: start, $lte: end } as any
        }
      }),
      
      // Session statistics
      activityTracker.getSessionStatistics(userId, start, end),
      
      // Performance metrics (if admin)
      req.user?.__type === 'admin' || req.user?.__type === 'techAdmin' 
        ? activityTracker.getPerformanceMetrics(undefined, start, end)
        : Promise.resolve([])
    ]);

    // Calculate analytics
    const analytics = {
      period: { start, end },
      userActivities: {
        total: userActivities.length,
        byType: userActivities.reduce((acc: any, activity: UserActivity) => {
          acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
          return acc;
        }, {}),
        recent: userActivities.slice(0, 10)
      },
      betActivities: {
        total: betActivities.length,
        totalStake: betActivities.reduce((sum: number, bet: BetActivity) => sum + Number(bet.stakeAmount), 0),
        totalWin: betActivities.reduce((sum: number, bet: BetActivity) => sum + Number(bet.actualWin || 0), 0),
        byType: betActivities.reduce((acc: any, bet: BetActivity) => {
          acc[bet.betType] = (acc[bet.betType] || 0) + 1;
          return acc;
        }, {}),
        byStatus: betActivities.reduce((acc: any, bet: BetActivity) => {
          acc[bet.status] = (acc[bet.status] || 0) + 1;
          return acc;
        }, {}),
        recent: betActivities.slice(0, 10)
      },
      sessionStats,
      performanceMetrics: req.user?.__type === 'admin' || req.user?.__type === 'techAdmin' 
        ? {
            total: performanceMetrics.length,
            averageResponseTime: performanceMetrics
              .filter((m: PerformanceMetric) => m.metricType === 'api_response_time')
              .reduce((sum: number, m: PerformanceMetric) => sum + Number(m.value), 0) / 
              performanceMetrics.filter((m: PerformanceMetric) => m.metricType === 'api_response_time').length || 0,
            byType: performanceMetrics.reduce((acc: any, metric: PerformanceMetric) => {
              acc[metric.metricType] = (acc[metric.metricType] || 0) + 1;
              return acc;
            }, {})
          }
        : null
    };

    return res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error: any) {
    console.error('Error fetching activity analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get downline activity (for upline users)
export const getDownlineActivity = async (req: Request, res: Response) => {
  try {
    const uplineUserId = req.user?.userId;
    const { limit = 50, offset = 0, userId } = req.query;

    if (!uplineUserId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    // This would need to be implemented based on your user hierarchy
    // For now, we'll just get activities for the specified user
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const activities = await activityTracker.getUserActivityHistory(
      userId as string,
      Number(limit),
      Number(offset)
    );

    return res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: activities.length
      }
    });

  } catch (error: any) {
    console.error('Error fetching downline activity:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
