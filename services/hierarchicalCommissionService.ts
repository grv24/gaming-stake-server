import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CommissionStructure {
  userId: string;
  userType: string;
  hierarchyLevel: number;
  commissionRate: number;
  commissionType: string;
  appliesToUserType?: string;
  appliesToUserId?: string;
}

export interface PartnershipStructure {
  userId: string;
  userType: string;
  hierarchyLevel: number;
  partnershipRate: number;
  partnershipType: string;
  appliesToUserType?: string;
  appliesToUserId?: string;
}

export interface CommissionBreakdown {
  userId: string;
  userType: string;
  hierarchyLevel: number;
  commissionAmount: number;
  commissionRate: number;
  commissionType: string;
}

export interface PartnershipBreakdown {
  userId: string;
  userType: string;
  hierarchyLevel: number;
  partnershipAmount: number;
  partnershipRate: number;
  partnershipType: string;
}

export class HierarchicalCommissionService {
  
  // User hierarchy levels
  private static readonly HIERARCHY_LEVELS = {
    CLIENT: 0,
    AGENT: 1,
    SUPER_AGENT: 2,
    MASTER: 3,
    SUPER_MASTER: 4,
    MINI_ADMIN: 5,
    ADMIN: 6,
    TECH_ADMIN: 7,
    DEVELOPER: 8
  };

  // Default commission rates by user type
  private static readonly DEFAULT_COMMISSION_RATES = {
    AGENT: 2.5,
    SUPER_AGENT: 1.5,
    MASTER: 1.0,
    SUPER_MASTER: 0.5,
    MINI_ADMIN: 0.3,
    ADMIN: 0.2,
    TECH_ADMIN: 0.1,
    DEVELOPER: 0.05
  };

  // Default partnership rates by user type
  private static readonly DEFAULT_PARTNERSHIP_RATES = {
    AGENT: 1.5,
    SUPER_AGENT: 1.0,
    MASTER: 0.8,
    SUPER_MASTER: 0.5,
    MINI_ADMIN: 0.3,
    ADMIN: 0.2,
    TECH_ADMIN: 0.1,
    DEVELOPER: 0.05
  };

  /**
   * Get hierarchy level for a user type
   */
  static getHierarchyLevel(userType: string): number {
    const type = userType.toUpperCase().replace(' ', '_');
    return this.HIERARCHY_LEVELS[type] || 0;
  }

  /**
   * Get default commission rate for a user type
   */
  static getDefaultCommissionRate(userType: string): number {
    const type = userType.toUpperCase().replace(' ', '_');
    return this.DEFAULT_COMMISSION_RATES[type] || 0;
  }

  /**
   * Get default partnership rate for a user type
   */
  static getDefaultPartnershipRate(userType: string): number {
    const type = userType.toUpperCase().replace(' ', '_');
    return this.DEFAULT_PARTNERSHIP_RATES[type] || 0;
  }

  /**
   * Get the complete upline hierarchy for a user
   */
  static async getUplineHierarchy(userId: string): Promise<any[]> {
    const user = await prisma.baseUser.findUnique({
      where: { id: userId },
      include: {
        upline: {
          include: {
            upline: {
              include: {
                upline: {
                  include: {
                    upline: {
                      include: {
                        upline: {
                          include: {
                            upline: {
                              include: {
                                upline: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return this.flattenUplineHierarchy(user);
  }

  /**
   * Flatten the nested upline hierarchy into an array
   */
  private static flattenUplineHierarchy(user: any): any[] {
    const hierarchy: any[] = [];
    let currentUser = user;

    while (currentUser?.upline) {
      hierarchy.push(currentUser.upline);
      currentUser = currentUser.upline;
    }

    return hierarchy;
  }

  /**
   * Create hierarchical commission structure when a client creates soccer settings
   */
  static async createHierarchicalCommission(
    clientId: string, 
    soccerSettingsId: string
  ): Promise<void> {
    const client = await prisma.baseUser.findUnique({
      where: { id: clientId },
      include: { upline: true }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Get the full upline hierarchy
    const uplineHierarchy = await this.getUplineHierarchy(clientId);
    
    // Create commission records for each upline level
    for (const upline of uplineHierarchy) {
      await prisma.matchCommission.create({
        data: {
          userId: upline.id,
          userType: upline.__type,
          hierarchyLevel: this.getHierarchyLevel(upline.__type),
          matchCommission: this.getDefaultCommissionRate(upline.__type),
          commissionType: "percentage",
          isActive: true,
          appliesToUserType: "client",
          appliesToUserId: clientId,
          soccerSettingsId: soccerSettingsId
        }
      });
    }
  }

  /**
   * Create hierarchical partnership structure when a client creates soccer settings
   */
  static async createHierarchicalPartnership(
    clientId: string, 
    soccerSettingsId: string
  ): Promise<void> {
    const client = await prisma.baseUser.findUnique({
      where: { id: clientId },
      include: { upline: true }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Get the full upline hierarchy
    const uplineHierarchy = await this.getUplineHierarchy(clientId);
    
    // Create partnership records for each upline level
    for (const upline of uplineHierarchy) {
      await prisma.partnership.create({
        data: {
          userId: upline.id,
          userType: upline.__type,
          hierarchyLevel: this.getHierarchyLevel(upline.__type),
          partnership: this.getDefaultPartnershipRate(upline.__type),
          partnershipType: "percentage",
          isActive: true,
          appliesToUserType: "client",
          appliesToUserId: clientId,
          soccerSettingsId: soccerSettingsId
        }
      });
    }
  }

  /**
   * Calculate commission breakdown for a bet
   */
  static async calculateBetCommission(
    clientId: string, 
    betAmount: number
  ): Promise<CommissionBreakdown[]> {
    // Get client's soccer settings and commission structure
    const clientSettings = await prisma.baseUser.findUnique({
      where: { id: clientId },
      include: {
        userSettings: {
          include: {
            soccerSettings: {
              include: {
                matchCommission: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!clientSettings?.userSettings?.soccerSettings?.matchCommission) {
      return [];
    }

    const commissionBreakdown: CommissionBreakdown[] = [];
    
    for (const commission of clientSettings.userSettings.soccerSettings.matchCommission) {
      const commissionAmount = betAmount * (commission.matchCommission / 100);
      
      commissionBreakdown.push({
        userId: commission.userId,
        userType: commission.userType,
        hierarchyLevel: commission.hierarchyLevel,
        commissionAmount,
        commissionRate: commission.matchCommission,
        commissionType: commission.commissionType
      });
    }
    
    return commissionBreakdown;
  }

  /**
   * Calculate partnership breakdown for a bet
   */
  static async calculateBetPartnership(
    clientId: string, 
    betAmount: number
  ): Promise<PartnershipBreakdown[]> {
    // Get client's soccer settings and partnership structure
    const clientSettings = await prisma.baseUser.findUnique({
      where: { id: clientId },
      include: {
        userSettings: {
          include: {
            soccerSettings: {
              include: {
                partnership: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!clientSettings?.userSettings?.soccerSettings?.partnership) {
      return [];
    }

    const partnershipBreakdown: PartnershipBreakdown[] = [];
    
    for (const partnership of clientSettings.userSettings.soccerSettings.partnership) {
      const partnershipAmount = betAmount * (partnership.partnership / 100);
      
      partnershipBreakdown.push({
        userId: partnership.userId,
        userType: partnership.userType,
        hierarchyLevel: partnership.hierarchyLevel,
        partnershipAmount,
        partnershipRate: partnership.partnership,
        partnershipType: partnership.partnershipType
      });
    }
    
    return partnershipBreakdown;
  }

  /**
   * Apply commission to upline users
   */
  static async applyCommissionToUpline(
    clientId: string, 
    betAmount: number
  ): Promise<void> {
    const commissionBreakdown = await this.calculateBetCommission(clientId, betAmount);
    
    for (const commission of commissionBreakdown) {
      // Update user balance or create commission transaction
      await prisma.baseUser.update({
        where: { id: commission.userId },
        data: {
          // Add commission to user's balance or create a separate transaction
          // This depends on your balance management system
        }
      });
    }
  }

  /**
   * Apply partnership to upline users
   */
  static async applyPartnershipToUpline(
    clientId: string, 
    betAmount: number
  ): Promise<void> {
    const partnershipBreakdown = await this.calculateBetPartnership(clientId, betAmount);
    
    for (const partnership of partnershipBreakdown) {
      // Update user balance or create partnership transaction
      await prisma.baseUser.update({
        where: { id: partnership.userId },
        data: {
          // Add partnership to user's balance or create a separate transaction
          // This depends on your balance management system
        }
      });
    }
  }

  /**
   * Get commission structure for a specific user
   */
  static async getUserCommissionStructure(userId: string): Promise<CommissionStructure[]> {
    const commissions = await prisma.matchCommission.findMany({
      where: { userId },
      include: { user: true }
    });

    return commissions.map(commission => ({
      userId: commission.userId,
      userType: commission.userType,
      hierarchyLevel: commission.hierarchyLevel,
      commissionRate: commission.matchCommission,
      commissionType: commission.commissionType,
      appliesToUserType: commission.appliesToUserType,
      appliesToUserId: commission.appliesToUserId
    }));
  }

  /**
   * Get partnership structure for a specific user
   */
  static async getUserPartnershipStructure(userId: string): Promise<PartnershipStructure[]> {
    const partnerships = await prisma.partnership.findMany({
      where: { userId },
      include: { user: true }
    });

    return partnerships.map(partnership => ({
      userId: partnership.userId,
      userType: partnership.userType,
      hierarchyLevel: partnership.hierarchyLevel,
      partnershipRate: partnership.partnership,
      partnershipType: partnership.partnershipType,
      appliesToUserType: partnership.appliesToUserType,
      appliesToUserId: partnership.appliesToUserId
    }));
  }
} 