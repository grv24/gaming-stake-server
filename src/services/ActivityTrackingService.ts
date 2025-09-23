import { AppDataSource } from '../server';
import { UserActivity, BetActivity, SessionActivity, PerformanceMetric } from '../entities/activity/ActivityEntities';
import { EventEmitter } from 'events';

export class ActivityTrackingService {
  private static instance: ActivityTrackingService;
  private eventEmitter: EventEmitter;

  private constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupEventHandlers();
  }

  public static getInstance(): ActivityTrackingService {
    if (!ActivityTrackingService.instance) {
      ActivityTrackingService.instance = new ActivityTrackingService();
    }
    return ActivityTrackingService.instance;
  }

  private setupEventHandlers() {
    this.eventEmitter.on('userActivity', this.trackUserActivity.bind(this));
    this.eventEmitter.on('betActivity', this.trackBetActivity.bind(this));
    this.eventEmitter.on('sessionActivity', this.trackSessionActivity.bind(this));
    this.eventEmitter.on('performanceMetric', this.trackPerformanceMetric.bind(this));
  }

  // Track general user activities
  public async trackUserActivity(data: {
    userId: string;
    userType: string;
    activityType: string;
    activityDescription: string;
    activityData?: any;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    groupId?: string;
  }) {
    try {
      const activityRepo = AppDataSource.getRepository(UserActivity);
      
      const activity = activityRepo.create({
        userId: data.userId,
        userType: data.userType,
        activityType: data.activityType,
        activityDescription: data.activityDescription,
        activityData: data.activityData,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        groupId: data.groupId,
      });

      await activityRepo.save(activity);
      
      // Emit real-time update
      this.eventEmitter.emit('activityUpdate', {
        type: 'userActivity',
        data: activity
      });

    } catch (error) {
      console.error('Error tracking user activity:', error);
    }
  }

  // Track betting activities
  public async trackBetActivity(data: {
    userId: string;
    userType: string;
    betType: 'sports' | 'casino';
    betId?: string;
    eventId: string;
    stakeAmount: number;
    potentialWin?: number;
    actualWin?: number;
    status: 'placed' | 'won' | 'lost' | 'cancelled' | 'refunded';
    betDetails?: any;
    commission?: any;
    exposure?: any;
    ipAddress?: string;
    userAgent?: string;
    groupId?: string;
  }) {
    try {
      const betActivityRepo = AppDataSource.getRepository(BetActivity);
      
      const betActivity = betActivityRepo.create({
        userId: data.userId,
        userType: data.userType,
        betType: data.betType,
        betId: data.betId,
        eventId: data.eventId,
        stakeAmount: data.stakeAmount,
        potentialWin: data.potentialWin,
        actualWin: data.actualWin,
        status: data.status,
        betDetails: data.betDetails,
        commission: data.commission,
        exposure: data.exposure,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        groupId: data.groupId,
      });

      await betActivityRepo.save(betActivity);
      
      // Emit real-time update
      this.eventEmitter.emit('activityUpdate', {
        type: 'betActivity',
        data: betActivity
      });

    } catch (error) {
      console.error('Error tracking bet activity:', error);
    }
  }

  // Track session activities
  public async trackSessionActivity(data: {
    userId: string;
    userType: string;
    sessionId: string;
    ipAddress: string;
    userAgent?: string;
    country?: string;
    city?: string;
    isp?: string;
    loginTime?: Date;
    logoutTime?: Date;
    isActive?: boolean;
    groupId?: string;
  }) {
    try {
      const sessionRepo = AppDataSource.getRepository(SessionActivity);
      
      // Check if session already exists
      let session = await sessionRepo.findOne({
        where: { sessionId: data.sessionId }
      });

      if (session) {
        // Update existing session
        if (data.logoutTime) {
          session.logoutTime = data.logoutTime;
        }
        session.isActive = data.isActive || false;
        await sessionRepo.save(session);
      } else {
        // Create new session
        session = sessionRepo.create({
          userId: data.userId,
          userType: data.userType,
          sessionId: data.sessionId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          country: data.country,
          city: data.city,
          isp: data.isp,
          loginTime: data.loginTime || new Date(),
          logoutTime: data.logoutTime,
          isActive: data.isActive || true,
          groupId: data.groupId,
        });

        await sessionRepo.save(session);
      }
      
      // Emit real-time update
      this.eventEmitter.emit('activityUpdate', {
        type: 'sessionActivity',
        data: session
      });

    } catch (error) {
      console.error('Error tracking session activity:', error);
    }
  }

  // Track performance metrics
  public async trackPerformanceMetric(data: {
    metricType: 'api_response_time' | 'database_query_time' | 'socket_connection' | 'memory_usage' | 'cpu_usage';
    endpoint?: string;
    method?: string;
    statusCode?: number;
    value: number;
    unit?: string;
    metadata?: any;
    groupId?: string;
  }) {
    try {
      const metricRepo = AppDataSource.getRepository(PerformanceMetric);
      
      const metric = metricRepo.create({
        metricType: data.metricType,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        value: data.value,
        unit: data.unit,
        metadata: data.metadata,
        groupId: data.groupId,
      });

      await metricRepo.save(metric);
      
      // Emit real-time update for monitoring
      this.eventEmitter.emit('performanceUpdate', {
        type: 'performanceMetric',
        data: metric
      });

    } catch (error) {
      console.error('Error tracking performance metric:', error);
    }
  }

  // Get user activity history
  public async getUserActivityHistory(userId: string, limit: number = 50, offset: number = 0) {
    try {
      const activityRepo = AppDataSource.getRepository(UserActivity);
      
      const activities = await activityRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return activities;
    } catch (error) {
      console.error('Error fetching user activity history:', error);
      return [];
    }
  }

  // Get betting activity history
  public async getBettingActivityHistory(userId: string, betType?: 'sports' | 'casino', limit: number = 50, offset: number = 0) {
    try {
      const betActivityRepo = AppDataSource.getRepository(BetActivity);
      
      const where: any = { userId };
      if (betType) {
        where.betType = betType;
      }

      const activities = await betActivityRepo.find({
        where,
        order: { createdAt: 'DESC' },
        take: limit,
        skip: offset,
      });

      return activities;
    } catch (error) {
      console.error('Error fetching betting activity history:', error);
      return [];
    }
  }

  // Get session statistics
  public async getSessionStatistics(userId: string, startDate?: Date, endDate?: Date) {
    try {
      const sessionRepo = AppDataSource.getRepository(SessionActivity);
      
      const where: any = { userId };
      if (startDate && endDate) {
        where.createdAt = { $gte: startDate, $lte: endDate } as any;
      }

      const sessions = await sessionRepo.find({ where });
      
      const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter((s: SessionActivity) => s.isActive).length,
        totalDuration: 0,
        averageDuration: 0,
        totalActivities: sessions.reduce((sum: number, s: SessionActivity) => sum + (s.totalActivities || 0), 0),
        totalBetAmount: sessions.reduce((sum: number, s: SessionActivity) => sum + Number(s.totalBetAmount || 0), 0),
      };

      // Calculate duration for completed sessions
      const completedSessions = sessions.filter((s: SessionActivity) => s.logoutTime);
      if (completedSessions.length > 0) {
        const totalDuration = completedSessions.reduce((sum: number, s: SessionActivity) => {
          return sum + (s.logoutTime!.getTime() - s.loginTime!.getTime());
        }, 0);
        
        stats.totalDuration = totalDuration;
        stats.averageDuration = totalDuration / completedSessions.length;
      }

      return stats;
    } catch (error) {
      console.error('Error fetching session statistics:', error);
      return null;
    }
  }

  // Get performance metrics
  public async getPerformanceMetrics(metricType?: string, startDate?: Date, endDate?: Date) {
    try {
      const metricRepo = AppDataSource.getRepository(PerformanceMetric);
      
      const where: any = {};
      if (metricType) {
        where.metricType = metricType;
      }
      if (startDate && endDate) {
        where.createdAt = { $gte: startDate, $lte: endDate } as any;
      }

      const metrics = await metricRepo.find({
        where,
        order: { createdAt: 'DESC' },
        take: 1000,
      });

      return metrics;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      return [];
    }
  }

  // Emit activity event
  public emitActivity(type: string, data: any) {
    this.eventEmitter.emit(type, data);
  }

  // Get event emitter for real-time updates
  public getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}

// Export singleton instance
export const activityTracker = ActivityTrackingService.getInstance();
