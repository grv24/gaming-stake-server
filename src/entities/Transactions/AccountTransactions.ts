import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from 'typeorm';

@Entity('account_transactions')
@Index(['downlineUserId', 'createdAt'])
@Index(['uplineUserId', 'createdAt'])
@Index(['type', 'createdAt'])
@Index(['depositRequestId'])
export class AccountTrasaction {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: "uuid" })
    uplineUserId!: string;

    @Column({ type: "uuid" })
    downlineUserId!: string;

    @Column({ type: "text" })
    remarks!: String;

    @Column({ 
        type: "enum", 
        enum: ["deposit", "withdraw", "place-bet", "settle-bet", "payment-gateway-deposit"]
    })
    type!: "deposit" | "withdraw" | "place-bet" | "settle-bet" | "payment-gateway-deposit";

    @Column({ type: 'float' })
    amount!: number;

    // Payment Gateway Integration Fields
    @Column({ type: 'uuid', nullable: true })
    depositRequestId!: string; // Reference to DepositRequest

    @Column({ type: 'uuid', nullable: true })
    gatewayId!: string; // Reference to PaymentGateway

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    balanceBefore!: number; // Balance before transaction

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    balanceAfter!: number; // Balance after transaction

    @Column({ type: 'varchar', length: 100, nullable: true })
    groupId!: string; // Group identifier for multi-tenant support

    @CreateDateColumn()
    createdAt !: Date;

    @UpdateDateColumn()
    updatedAt !: Date;

    // Relations (commented out to avoid metadata issues)
    // @ManyToOne(() => DepositRequest, { nullable: true })
    // @JoinColumn({ name: 'depositRequestId' })
    // depositRequest!: DepositRequest;

    // @ManyToOne(() => PaymentGateway, { nullable: true })
    // @JoinColumn({ name: 'gatewayId' })
    // paymentGateway!: PaymentGateway;

    // Helper methods
    public isPaymentGatewayDeposit(): boolean {
        return this.type === 'payment-gateway-deposit';
    }

    public isBetRelated(): boolean {
        return this.type === 'place-bet' || this.type === 'settle-bet';
    }

    public isManualTransaction(): boolean {
        return this.type === 'deposit' || this.type === 'withdraw';
    }

    public getBalanceChange(): number {
        if (this.type === 'deposit' || this.type === 'payment-gateway-deposit') {
            return this.amount;
        } else if (this.type === 'withdraw') {
            return -this.amount;
        }
        return 0;
    }

    public getTypeDisplay(): string {
        switch (this.type) {
            case 'deposit':
                return 'Manual Deposit';
            case 'withdraw':
                return 'Manual Withdrawal';
            case 'place-bet':
                return 'Bet Placed';
            case 'settle-bet':
                return 'Bet Settlement';
            case 'payment-gateway-deposit':
                return 'Payment Gateway Deposit';
            default:
                return this.type;
        }
    }
}
