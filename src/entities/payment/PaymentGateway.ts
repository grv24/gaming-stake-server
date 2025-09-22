import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('paymentGateway')
@Index(['createdBy', 'isActive'])
@Index(['createdBy'])
export class PaymentGateway {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  gatewayMethod!: string; // e.g., "UPI", "Bank Transfer", "Paytm", "PhonePe"

  @Column({ type: 'varchar', length: 500, nullable: true })
  gatewayImage!: string; // Path to gateway logo/image

  @Column({ type: 'varchar', length: 500, nullable: true })
  qrImage!: string; // Path to QR code image

  @Column({ type: 'jsonb' })
  gatewayDetails!: {
    minAmount?: number;
    maxAmount?: number;
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
    accountHolder?: string;
    bankName?: string;
    branchName?: string;
    phoneNumber?: string;
    [key: string]: any; // For additional gateway-specific fields
  };

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'uuid' })
  createdBy!: string; // Reference to user who created this gateway

  @Column({ type: 'varchar', length: 50 })
  createdByType!: string; // User type who created (developer, techAdmin, etc.)

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string; // Group identifier for multi-tenant support

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Helper methods
  public isMinimumAmountValid(amount: number): boolean {
    const minAmount = this.gatewayDetails?.minAmount || 0;
    return amount >= minAmount;
  }

  public isMaximumAmountValid(amount: number): boolean {
    const maxAmount = this.gatewayDetails?.maxAmount;
    return maxAmount ? amount <= maxAmount : true;
  }

  public isValidAmount(amount: number): boolean {
    return this.isMinimumAmountValid(amount) && this.isMaximumAmountValid(amount);
  }

  public getDisplayName(): string {
    return this.gatewayMethod;
  }

  public getAccountDetails(): any {
    return this.gatewayDetails;
  }
}

