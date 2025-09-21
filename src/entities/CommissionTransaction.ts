import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CommissionType {
  PANEL = 'panel',
  MATCH = 'match',
  SESSION = 'session'
}

export enum CommissionStatus {
  PENDING = 'pending',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

export enum SportType {
  SOCCER = 'Soccer',
  TENNIS = 'Tennis',
  CRICKET = 'Cricket',
  MATKA = 'Matka',
  CASINO = 'Casino',
  DIAMOND_CASINO = 'DiamondCasino'
}

@Entity('commission_transactions')
@Index(['userId', 'createdAt'])
@Index(['uplineUserId', 'createdAt'])
@Index(['betId'])
@Index(['settlementDate'])
export class CommissionTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Bet Information
  @Column({ type: 'uuid', nullable: true })
  betId!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  userType!: string;

  @Column({ type: 'varchar' })
  userLoginId!: string;

  // Upline Information
  @Column({ type: 'uuid' })
  uplineUserId!: string;

  @Column({ type: 'varchar' })
  uplineUserType!: string;

  @Column({ type: 'varchar' })
  uplineLoginId!: string;

  // Commission Details
  @Column({ type: 'enum', enum: CommissionType })
  commissionType!: CommissionType;

  @Column({ type: 'enum', enum: SportType, nullable: true })
  sportType!: SportType;

  @Column({ type: 'float' })
  betAmount!: number;

  @Column({ type: 'float' })
  commissionRate!: number;

  @Column({ type: 'float' })
  commissionAmount!: number;

  @Column({ type: 'enum', enum: CommissionStatus, default: CommissionStatus.PENDING })
  status!: CommissionStatus;

  // Settlement Information
  @Column({ type: 'date', nullable: true })
  settlementDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  settledAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  settledBy!: string;

  // Additional Information
  @Column({ type: 'text', nullable: true })
  remarks!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: any;

  // Audit Fields
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Helper methods
  public isSettled(): boolean {
    return this.status === CommissionStatus.SETTLED;
  }

  public isPending(): boolean {
    return this.status === CommissionStatus.PENDING;
  }

  public canBeSettled(): boolean {
    return this.status === CommissionStatus.PENDING;
  }

  public getCommissionPercentage(): number {
    return (this.commissionAmount / this.betAmount) * 100;
  }
}

