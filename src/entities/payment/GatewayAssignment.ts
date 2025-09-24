import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PaymentGateway } from './PaymentGateway';

@Entity('gatewayAssignment')
@Index(['assignedToUserId', 'isActive'])
@Index(['assignedByUserId', 'createdAt'])
@Index(['gatewayId', 'isActive'])
export class GatewayAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  gatewayId!: string | null; // Reference to PaymentGateway (nullable for general permissions)

  @Column({ type: 'uuid' })
  assignedToUserId!: string; // User who receives the gateway assignment

  @Column({ type: 'varchar', length: 50 })
  assignedToUserType!: string; // Type of user receiving assignment (techAdmin, admin, etc.)

  @Column({ type: 'uuid' })
  assignedByUserId!: string; // User who assigned the gateway

  @Column({ type: 'varchar', length: 50 })
  assignedByUserType!: string; // Type of user who assigned (techAdmin, admin, etc.)

  @Column({ type: 'varchar', length: 100 })
  groupId!: string; // User group identifier for multi-tenant support

  @Column({ type: 'boolean', default: true })
  isActive!: boolean; // Whether the assignment is currently active

  @Column({ type: 'text', nullable: true })
  notes!: string; // Optional notes about the assignment

  // Granular permissions for this gateway assignment
  @Column({ type: 'boolean', default: false })
  canCreateGateway!: boolean; // Can create new gateways

  @Column({ type: 'boolean', default: false })
  canManageGateway!: boolean; // Can manage existing gateways

  @Column({ type: 'boolean', default: false })
  canAssignGateway!: boolean; // Can assign gateways to other users

  @Column({ type: 'boolean', default: false })
  canProcessRequests!: boolean; // Can process deposit/withdrawal requests

  @Column({ type: 'jsonb', nullable: true })
  restrictions!: {
    maxGateways?: number;
    maxAmount?: number;
    allowedGatewayTypes?: string[];
  } | null; // Optional restrictions for this assignment

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => PaymentGateway, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'gatewayId' })
  gateway!: PaymentGateway;

  // Helper methods
  public isAssignmentActive(): boolean {
    return this.isActive;
  }

  public deactivateAssignment(): void {
    this.isActive = false;
  }

  public activateAssignment(): void {
    this.isActive = true;
  }

  public getAssignmentInfo(): string {
    return `Gateway ${this.gatewayId} assigned to ${this.assignedToUserType} (${this.assignedToUserId}) by ${this.assignedByUserType} (${this.assignedByUserId})`;
  }

  // Permission helper methods
  public hasPermission(permission: 'canCreateGateway' | 'canManageGateway' | 'canAssignGateway' | 'canProcessRequests'): boolean {
    return this.isActive && this[permission];
  }

  public getAllPermissions(): {
    canCreateGateway: boolean;
    canManageGateway: boolean;
    canAssignGateway: boolean;
    canProcessRequests: boolean;
  } {
    return {
      canCreateGateway: this.canCreateGateway,
      canManageGateway: this.canManageGateway,
      canAssignGateway: this.canAssignGateway,
      canProcessRequests: this.canProcessRequests
    };
  }

  public setPermissions(permissions: {
    canCreateGateway?: boolean;
    canManageGateway?: boolean;
    canAssignGateway?: boolean;
    canProcessRequests?: boolean;
  }): void {
    this.canCreateGateway = permissions.canCreateGateway ?? this.canCreateGateway;
    this.canManageGateway = permissions.canManageGateway ?? this.canManageGateway;
    this.canAssignGateway = permissions.canAssignGateway ?? this.canAssignGateway;
    this.canProcessRequests = permissions.canProcessRequests ?? this.canProcessRequests;
  }

  public hasAnyPermission(): boolean {
    return this.canCreateGateway || this.canManageGateway || this.canAssignGateway || this.canProcessRequests;
  }
}

