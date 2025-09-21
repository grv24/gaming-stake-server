import { DataSource } from 'typeorm';
import { CommissionIntegrationService } from './CommissionIntegrationService';

interface CommissionTask {
  type: 'bet' | 'settlement';
  betId: string;
  userId: string;
  userType: string;
  betAmount?: number;
  sportType?: string;
  commissionType?: string;
  settlementData?: {
    isWinner: boolean;
    profitLoss: number;
    settlementAmount: number;
  };
}

export class CommissionQueueService {
  private dataSource: DataSource;
  private queue: CommissionTask[] = [];
  private isProcessing = false;
  private maxBatchSize = 100; // Increased batch size for better performance
  private processingInterval = 2000; // Increased interval to reduce database load
  private highPriorityQueue: CommissionTask[] = []; // Separate queue for high priority tasks

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.startProcessing();
  }

  /**
   * Add commission task to queue (non-blocking) with priority support
   */
  public addCommissionTask(task: CommissionTask, priority: 'high' | 'normal' = 'normal'): void {
    // Check if commission processing is disabled
    if (this.isCommissionProcessingDisabled()) {
      console.log(`[COMMISSION-QUEUE] Commission processing disabled - skipping task for bet ${task.betId}`);
      return;
    }

    if (priority === 'high') {
      this.highPriorityQueue.push(task);
      console.log(`[COMMISSION-QUEUE] Added HIGH priority task to queue. High priority queue size: ${this.highPriorityQueue.length}`);
    } else {
      this.queue.push(task);
      console.log(`[COMMISSION-QUEUE] Added task to queue. Queue size: ${this.queue.length}`);
    }
  }

  /**
   * Process commission task immediately (for critical operations)
   */
  public async processCommissionTaskImmediately(task: CommissionTask): Promise<void> {
    try {
      const commissionIntegration = new CommissionIntegrationService(this.dataSource);
      
      if (task.type === 'bet') {
        await commissionIntegration.processBetCommission({
          betId: task.betId,
          userId: task.userId,
          userType: task.userType,
          betAmount: task.betAmount!,
          sportType: task.sportType as any,
          commissionType: task.commissionType as any
        });
      } else if (task.type === 'settlement') {
        await commissionIntegration.processBetSettlement(task.betId, task.settlementData!);
      }
      
      console.log(`[COMMISSION-QUEUE] Processed ${task.type} task immediately for bet ${task.betId}`);
    } catch (error: any) {
      console.error(`[COMMISSION-QUEUE] Failed to process ${task.type} task immediately for bet ${task.betId}:`, error.message);
      // Fallback to queue if immediate processing fails
      this.addCommissionTask(task);
    }
  }

  /**
   * Start processing queue
   */
  private startProcessing(): void {
    setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.processBatch();
      }
    }, this.processingInterval);
  }

  /**
   * Process a batch of commission tasks with priority support
   */
  private async processBatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    // Check if we have any tasks to process
    const totalTasks = this.highPriorityQueue.length + this.queue.length;
    if (totalTasks === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();
    
    // Process high priority tasks first
    const highPriorityBatch = this.highPriorityQueue.splice(0, Math.min(this.maxBatchSize, this.highPriorityQueue.length));
    const normalBatch = this.queue.splice(0, Math.min(this.maxBatchSize - highPriorityBatch.length, this.queue.length));
    
    const totalBatchSize = highPriorityBatch.length + normalBatch.length;
    console.log(`[COMMISSION-QUEUE] Processing batch: ${highPriorityBatch.length} high priority + ${normalBatch.length} normal = ${totalBatchSize} total tasks`);

    try {
      const commissionIntegration = new CommissionIntegrationService(this.dataSource);
      
      // Process high priority tasks first
      for (const task of highPriorityBatch) {
        const taskStartTime = Date.now();
        try {
          await this.processTask(commissionIntegration, task);
          const taskTime = Date.now() - taskStartTime;
          if (taskTime > 1000) {
            console.warn(`[COMMISSION-QUEUE] High priority task ${task.type} for bet ${task.betId} took ${taskTime}ms`);
          }
        } catch (error: any) {
          console.error(`[COMMISSION-QUEUE] Failed to process high priority ${task.type} task for bet ${task.betId}:`, error.message);
        }
      }

      // Process normal priority tasks
      for (const task of normalBatch) {
        const taskStartTime = Date.now();
        try {
          await this.processTask(commissionIntegration, task);
          const taskTime = Date.now() - taskStartTime;
          if (taskTime > 2000) {
            console.warn(`[COMMISSION-QUEUE] Normal priority task ${task.type} for bet ${task.betId} took ${taskTime}ms`);
          }
        } catch (error: any) {
          console.error(`[COMMISSION-QUEUE] Failed to process normal priority ${task.type} task for bet ${task.betId}:`, error.message);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[COMMISSION-QUEUE] Completed batch processing: ${totalBatchSize} tasks in ${totalTime}ms (avg: ${Math.round(totalTime / totalBatchSize)}ms per task)`);
      
      // Log performance warnings
      if (totalTime > 5000) {
        console.warn(`[COMMISSION-QUEUE] Batch processing took ${totalTime}ms - consider increasing processing interval`);
      }
      
    } catch (error: any) {
      console.error(`[COMMISSION-QUEUE] Batch processing failed:`, error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual task
   */
  private async processTask(commissionIntegration: CommissionIntegrationService, task: CommissionTask): Promise<void> {
    if (task.type === 'bet') {
      await commissionIntegration.processBetCommission({
        betId: task.betId,
        userId: task.userId,
        userType: task.userType,
        betAmount: task.betAmount!,
        sportType: task.sportType as any,
        commissionType: task.commissionType as any
      });
    } else if (task.type === 'settlement') {
      await commissionIntegration.processBetSettlement(task.betId, task.settlementData!);
    }
    
    console.log(`[COMMISSION-QUEUE] Processed ${task.type} task for bet ${task.betId}`);
  }

  /**
   * Get queue status with detailed information
   */
  public getQueueStatus(): { 
    queueSize: number; 
    highPriorityQueueSize: number;
    totalQueueSize: number;
    isProcessing: boolean;
    processingInterval: number;
    maxBatchSize: number;
  } {
    return {
      queueSize: this.queue.length,
      highPriorityQueueSize: this.highPriorityQueue.length,
      totalQueueSize: this.queue.length + this.highPriorityQueue.length,
      isProcessing: this.isProcessing,
      processingInterval: this.processingInterval,
      maxBatchSize: this.maxBatchSize
    };
  }

  /**
   * Clear queue (for testing)
   */
  public clearQueue(): void {
    this.queue = [];
    this.highPriorityQueue = [];
    console.log(`[COMMISSION-QUEUE] All queues cleared`);
  }

  /**
   * Check if commission processing is disabled
   */
  private isCommissionProcessingDisabled(): boolean {
    return process.env.DISABLE_COMMISSION_PROCESSING === 'true';
  }
}
