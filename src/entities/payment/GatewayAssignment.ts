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

  @Column({ type: 'uuid' })
  gatewayId!: string; // Reference to PaymentGateway

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
}

