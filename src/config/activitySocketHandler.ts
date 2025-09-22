import { Server as SocketIOServer } from 'socket.io';
import { activityTracker } from '../services/ActivityTrackingService';

export function setupActivityTrackingSocket(io: SocketIOServer) {
  // Listen for activity updates
  activityTracker.getEventEmitter().on('activityUpdate', (data) => {
    // Broadcast to specific user
    if (data.data.userId) {
      io.to(`user_${data.data.userId}`).emit('activityUpdate', data);
    }
    
    // Broadcast to admin users for monitoring
    io.to('admin_monitoring').emit('activityUpdate', data);
  });

  // Listen for performance updates
  activityTracker.getEventEmitter().on('performanceUpdate', (data) => {
    // Broadcast to admin users for monitoring
    io.to('admin_monitoring').emit('performanceUpdate', data);
  });

  io.on('connection', (socket) => {
    console.log('Activity tracking socket connected:', socket.id);

    // Join user-specific room
    socket.on('joinUserRoom', (userId: string) => {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined user room: user_${userId}`);
    });

    // Join admin monitoring room
    socket.on('joinAdminMonitoring', (userType: string) => {
      if (userType === 'admin' || userType === 'techAdmin') {
        socket.join('admin_monitoring');
        console.log(`Socket ${socket.id} joined admin monitoring room`);
      }
    });

    // Track real-time user activities
    socket.on('trackActivity', (data) => {
      if (data.userId && data.activityType) {
        activityTracker.trackUserActivity({
          userId: data.userId,
          userType: data.userType,
          activityType: data.activityType,
          activityDescription: data.description,
          activityData: data.data,
          sessionId: socket.id,
        });
      }
    });

    // Track real-time betting activities
    socket.on('trackBetActivity', (data) => {
      if (data.userId && data.betType) {
        activityTracker.trackBetActivity({
          userId: data.userId,
          userType: data.userType,
          betType: data.betType,
          eventId: data.eventId,
          stakeAmount: data.stakeAmount,
          potentialWin: data.potentialWin,
          status: data.status,
          betDetails: data.betDetails,
          sessionId: socket.id,
        });
      }
    });

    // Track performance metrics
    socket.on('trackPerformance', (data) => {
      activityTracker.trackPerformanceMetric({
        metricType: data.metricType,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        value: data.value,
        unit: data.unit,
        metadata: data.metadata,
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Activity tracking socket disconnected:', socket.id);
    });
  });
}
