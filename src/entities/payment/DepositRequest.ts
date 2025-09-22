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

@Entity('depositRequest')
@Index(['uplineId', 'status'])
@Index(['clientId', 'status'])
@Index(['gatewayId'])
@Index(['status', 'createdAt'])
@Index(['groupId'])
export class DepositRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  transactionNo!: string; // Transaction reference number

  @Column({ type: 'varchar', length: 500, nullable: true })
  paymentProof!: string; // Path to uploaded payment proof

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number; // Deposit amount

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  balance!: number; // User balance at time of request

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string; // Client IP address

  @Column({ 
    type: 'enum', 
    enum: ['Pending', 'Approved', 'Declined'],
    default: 'Pending'
  })
  status!: 'Pending' | 'Approved' | 'Declined';

  @Column({ type: 'text', nullable: true })
  reason!: string; // Reason for decline (optional)

  @Column({ type: 'uuid' })
  uplineId!: string; // Reference to admin who will process this

  @Column({ type: 'varchar', length: 50 })
  uplineType!: string; // Type of upline user

  @Column({ type: 'uuid' })
  clientId!: string; // Reference to client making the request

  @Column({ type: 'varchar', length: 50 })
  clientType!: string; // Type of client user

  @Column({ type: 'uuid' })
  gatewayId!: string; // Reference to PaymentGateway

  @Column({ type: 'jsonb' })
  gatewayMethod!: {
    gatewayMethod: string;
    gatewayDetails: any;
  }; // Embedded gateway details snapshot

  @Column({ type: 'varchar', length: 100 })
  groupId!: string; // User group identifier

  @Column({ type: 'varchar', length: 100 })
  loginId!: string; // User login identifier

  @Column({ type: 'uuid', nullable: true })
  processedBy!: string; // Admin who processed the request

  @Column({ type: 'varchar', length: 50, nullable: true })
  processedByType!: string; // Type of admin who processed

  @Column({ type: 'timestamp', nullable: true })
  processedAt!: Date; // When the request was processed

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => PaymentGateway)
  @JoinColumn({ name: 'gatewayId' })
  gateway!: PaymentGateway;

  // Helper methods
  public isPending(): boolean {
    return this.status === 'Pending';
  }

  public isApproved(): boolean {
    return this.status === 'Approved';
  }

  public isDeclined(): boolean {
    return this.status === 'Declined';
  }

  public canBeProcessed(): boolean {
    return this.status === 'Pending';
  }

  public approve(processedBy: string, processedByType: string): void {
    this.status = 'Approved';
    this.processedBy = processedBy;
    this.processedByType = processedByType;
    this.processedAt = new Date();
  }

  public decline(processedBy: string, processedByType: string, reason?: string): void {
    this.status = 'Declined';
    this.processedBy = processedBy;
    this.processedByType = processedByType;
    this.processedAt = new Date();
    if (reason) {
      this.reason = reason;
    }
  }

  public getStatusDisplay(): string {
    switch (this.status) {
      case 'Pending':
        return 'Pending Review';
      case 'Approved':
        return 'Approved';
      case 'Declined':
        return 'Declined';
      default:
        return this.status;
    }
  }

  public getProcessingTime(): number | null {
    if (this.processedAt) {
      return this.processedAt.getTime() - this.createdAt.getTime();
    }
    return null;
  }
}

