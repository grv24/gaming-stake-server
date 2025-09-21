import { DataSource } from 'typeorm';
import { CasinoBet } from '../entities/casino/CasinoBet';
import { CasinoMatchNew } from '../entities/casino/CasinoMatchNew';
import { USER_TABLES } from '../Helpers/users/Roles';
import { CommissionQueueService } from './CommissionQueueService';

interface PendingBetIssue {
  betId: string;
  issue: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  suggestedFix?: string;
}

interface SettlementStats {
  totalPending: number;
  issuesFound: number;
  fixableIssues: number;
  criticalIssues: number;
  settlementSuccessRate: number;
}

export class CasinoSettlementMonitor {
  private dataSource: DataSource;
  private commissionQueue: CommissionQueueService;
  private casinoBetRepo: any;
  private casinoMatchRepo: any;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.casinoBetRepo = dataSource.getRepository(CasinoBet);
    this.casinoMatchRepo = dataSource.getRepository(CasinoMatchNew);
    this.commissionQueue = new CommissionQueueService(dataSource);
  }

  /**
   * ANALYZE PENDING CASINO BETS
   * 
   * Purpose: Analyze all pending casino bets and identify issues
   */
  async analyzePendingBets(): Promise<{
    stats: SettlementStats;
    issues: PendingBetIssue[];
    recommendations: string[];
  }> {
    try {
      console.log('[CASINO-MONITOR] Starting analysis of pending casino bets...');

      // Get all pending bets
      const pendingBets = await this.casinoBetRepo.find({
        where: { status: 'pending' },
        order: { createdAt: 'DESC' },
        take: 1000 // Limit to prevent memory issues
      });

      console.log(`[CASINO-MONITOR] Found ${pendingBets.length} pending bets to analyze`);

      const issues: PendingBetIssue[] = [];
      let fixableIssues = 0;
      let criticalIssues = 0;

      // Analyze each pending bet
      for (const bet of pendingBets) {
        const betIssues = await this.analyzeBet(bet);
        issues.push(...betIssues);

        betIssues.forEach(issue => {
          if (issue.fixable) fixableIssues++;
          if (issue.severity === 'critical') criticalIssues++;
        });
      }

      // Calculate stats
      const stats: SettlementStats = {
        totalPending: pendingBets.length,
        issuesFound: issues.length,
        fixableIssues,
        criticalIssues,
        settlementSuccessRate: pendingBets.length > 0 ? 
          ((pendingBets.length - issues.length) / pendingBets.length) * 100 : 100
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(issues, stats);

      console.log(`[CASINO-MONITOR] Analysis complete: ${issues.length} issues found, ${fixableIssues} fixable`);

      return { stats, issues, recommendations };
    } catch (error: any) {
      console.error('[CASINO-MONITOR] Error analyzing pending bets:', error);
      throw error;
    }
  }

  /**
   * ANALYZE INDIVIDUAL BET
   */
  private async analyzeBet(bet: any): Promise<PendingBetIssue[]> {
    const issues: PendingBetIssue[] = [];
    const betData = bet.betData || {};

    // Check for missing SID
    if (!betData.sid) {
      issues.push({
        betId: bet.id,
        issue: 'Missing SID in bet data',
        severity: 'critical',
        fixable: false,
        suggestedFix: 'Bet cannot be settled without SID - manual intervention required'
      });
    }

    // Check for missing stake amount
    if (!betData.stake || betData.stake <= 0) {
      issues.push({
        betId: bet.id,
        issue: 'Invalid or missing stake amount',
        severity: 'high',
        fixable: false,
        suggestedFix: 'Stake amount must be corrected manually'
      });
    }

    // Check for missing user
    try {
      const userRepo = this.dataSource.getRepository(USER_TABLES[bet.userType]);
      const user = await userRepo.findOne({ where: { id: bet.userId } });
      if (!user) {
        issues.push({
          betId: bet.id,
          issue: 'User not found',
          severity: 'critical',
          fixable: false,
          suggestedFix: 'User account may have been deleted - manual intervention required'
        });
      }
    } catch (error: any) {
      issues.push({
        betId: bet.id,
        issue: 'Invalid user type',
        severity: 'high',
        fixable: false,
        suggestedFix: 'User type validation failed'
      });
    }

    // Check for missing match data
    try {
      const match = await this.casinoMatchRepo.findOne({ 
        where: { mid: bet.matchId } 
      });
      if (!match) {
        issues.push({
          betId: bet.id,
          issue: 'Match not found',
          severity: 'medium',
          fixable: true,
          suggestedFix: 'Match data may need to be fetched from external API'
        });
      } else if (!match.winner) {
        issues.push({
          betId: bet.id,
          issue: 'Match has no winner data',
          severity: 'medium',
          fixable: true,
          suggestedFix: 'Winner data needs to be fetched from external API'
        });
      }
    } catch (error: any) {
      issues.push({
        betId: bet.id,
        issue: 'Match lookup failed',
        severity: 'medium',
        fixable: true,
        suggestedFix: 'Match data lookup error - retry settlement'
      });
    }

    // Check for stale bets (older than 24 hours)
    const betAge = Date.now() - new Date(bet.createdAt).getTime();
    const hoursOld = betAge / (1000 * 60 * 60);
    if (hoursOld > 24) {
      issues.push({
        betId: bet.id,
        issue: `Bet is ${Math.round(hoursOld)} hours old`,
        severity: hoursOld > 72 ? 'high' : 'medium',
        fixable: true,
        suggestedFix: 'Stale bet - check if settlement was missed'
      });
    }

    return issues;
  }

  /**
   * AUTO-FIX FIXABLE ISSUES
   */
  async autoFixIssues(): Promise<{
    fixed: number;
    failed: number;
    errors: string[];
  }> {
    try {
      console.log('[CASINO-MONITOR] Starting auto-fix process...');

      const { issues } = await this.analyzePendingBets();
      const fixableIssues = issues.filter(issue => issue.fixable);
      
      let fixed = 0;
      let failed = 0;
      const errors: string[] = [];

      console.log(`[CASINO-MONITOR] Found ${fixableIssues.length} fixable issues`);

      for (const issue of fixableIssues) {
        try {
          const success = await this.fixIssue(issue);
          if (success) {
            fixed++;
            console.log(`[CASINO-MONITOR] Fixed issue for bet ${issue.betId}: ${issue.issue}`);
          } else {
            failed++;
            errors.push(`Failed to fix ${issue.issue} for bet ${issue.betId}`);
          }
        } catch (error: any) {
          failed++;
          errors.push(`Error fixing ${issue.issue} for bet ${issue.betId}: ${error.message}`);
        }
      }

      console.log(`[CASINO-MONITOR] Auto-fix complete: ${fixed} fixed, ${failed} failed`);

      return { fixed, failed, errors };
    } catch (error: any) {
      console.error('[CASINO-MONITOR] Error in auto-fix process:', error);
      throw error;
    }
  }

  /**
   * FIX INDIVIDUAL ISSUE
   */
  private async fixIssue(issue: PendingBetIssue): Promise<boolean> {
    try {
      const bet = await this.casinoBetRepo.findOne({ where: { id: issue.betId } });
      if (!bet) return false;

      switch (issue.issue) {
        case 'Match not found':
        case 'Match has no winner data':
          return await this.fetchMatchData(bet);
        
        case 'Match lookup failed':
          return await this.retryMatchLookup(bet);
        
        case 'Bet is X hours old':
          return await this.retrySettlement(bet);
        
        default:
          return false;
      }
    } catch (error: any) {
      console.error(`[CASINO-MONITOR] Error fixing issue for bet ${issue.betId}:`, error);
      return false;
    }
  }

  /**
   * FETCH MISSING MATCH DATA
   */
  private async fetchMatchData(bet: any): Promise<boolean> {
    try {
      // This would integrate with your existing match data fetching logic
      console.log(`[CASINO-MONITOR] Fetching match data for bet ${bet.id}, match ${bet.matchId}`);
      
      // For now, just mark as retry needed
      await this.casinoBetRepo.update(bet.id, {
        betData: {
          ...bet.betData,
          retrySettlement: true,
          lastRetryAt: new Date().toISOString()
        }
      });
      
      return true;
    } catch (error: any) {
      console.error(`[CASINO-MONITOR] Error fetching match data for bet ${bet.id}:`, error);
      return false;
    }
  }

  /**
   * RETRY MATCH LOOKUP
   */
  private async retryMatchLookup(bet: any): Promise<boolean> {
    try {
      // Retry the match lookup with better error handling
      const match = await this.casinoMatchRepo.findOne({ 
        where: { mid: bet.matchId },
        lock: { mode: 'pessimistic_read' }
      });
      
      if (match && match.winner) {
        // Trigger settlement for this bet
        return await this.retrySettlement(bet);
      }
      
      return false;
    } catch (error: any) {
      console.error(`[CASINO-MONITOR] Error retrying match lookup for bet ${bet.id}:`, error);
      return false;
    }
  }

  /**
   * RETRY SETTLEMENT
   */
  private async retrySettlement(bet: any): Promise<boolean> {
    try {
      // Use the existing settlement service to retry settlement
      const { CasinoSettlementService } = await import('./casino/CasinoSettlementService');
      const settlementService = new CasinoSettlementService(this.dataSource);
      
      const result = await settlementService.settleCasinoMatch(
        bet.betData?.gameSlug || 'unknown',
        bet.matchId
      );
      
      return result.settledCount > 0;
    } catch (error: any) {
      console.error(`[CASINO-MONITOR] Error retrying settlement for bet ${bet.id}:`, error);
      return false;
    }
  }

  /**
   * GENERATE RECOMMENDATIONS
   */
  private generateRecommendations(issues: PendingBetIssue[], stats: SettlementStats): string[] {
    const recommendations: string[] = [];

    if (stats.criticalIssues > 0) {
      recommendations.push(`🚨 ${stats.criticalIssues} critical issues require immediate attention`);
    }

    if (stats.fixableIssues > 0) {
      recommendations.push(`🔧 ${stats.fixableIssues} issues can be auto-fixed`);
    }

    if (stats.settlementSuccessRate < 80) {
      recommendations.push(`⚠️ Settlement success rate is ${stats.settlementSuccessRate.toFixed(1)}% - below threshold`);
    }

    const staleBets = issues.filter(issue => issue.issue.includes('hours old'));
    if (staleBets.length > 0) {
      recommendations.push(`⏰ ${staleBets.length} stale bets need settlement retry`);
    }

    const missingSids = issues.filter(issue => issue.issue === 'Missing SID in bet data');
    if (missingSids.length > 0) {
      recommendations.push(`🔍 ${missingSids.length} bets missing SID - check bet placement process`);
    }

    return recommendations;
  }

  /**
   * GET SETTLEMENT HEALTH STATUS
   */
  async getSettlementHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    stats: SettlementStats;
    lastChecked: string;
  }> {
    try {
      const { stats } = await this.analyzePendingBets();
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = 'Casino settlement system is healthy';

      if (stats.criticalIssues > 0) {
        status = 'critical';
        message = `${stats.criticalIssues} critical issues detected`;
      } else if (stats.settlementSuccessRate < 80) {
        status = 'warning';
        message = `Settlement success rate is ${stats.settlementSuccessRate.toFixed(1)}%`;
      } else if (stats.totalPending > 100) {
        status = 'warning';
        message = `${stats.totalPending} pending bets - high volume`;
      }

      return {
        status,
        message,
        stats,
        lastChecked: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[CASINO-MONITOR] Error getting settlement health:', error);
      return {
        status: 'critical',
        message: 'Failed to check settlement health',
        stats: {
          totalPending: 0,
          issuesFound: 0,
          fixableIssues: 0,
          criticalIssues: 0,
          settlementSuccessRate: 0
        },
        lastChecked: new Date().toISOString()
      };
    }
  }
}
