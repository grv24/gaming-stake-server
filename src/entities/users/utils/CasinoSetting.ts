import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';

@Entity('casino_settings')
export class CasinoSettings {
  
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar"})
  user__type !: string;

  @Column({ default: false })
  isWhiteListed!: boolean;

  @Column({ type: 'float', default: 1.01 })
  minOddsToBet!: number;

  @Column({ type: 'float', default: 24 })
  maxOddsToBet!: number;

  @Column({ default: 1 })
  betDelay!: number;

  @Column({ type: 'float', default: 100 })
  minMatchStake!: number;

  @Column({ type: 'float', default: 100 })
  maxMatchStake!: number;

  @Column({ type: 'float', default: 0 })
  maxProfit!: number;

  @Column({ type: 'float', default: 0 })
  maxLoss!: number;

  @Column({ type: 'float', default: 0 })
  minExposure!: number;

  @Column({ type: 'float', default: 0 })
  maxExposure!: number;

  @Column({ type: 'float', default: 0 })
  winningLimit!: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "superAgent", "agent"] , nullable: true })
  commissionUplineType !: string | null;

  @Column({ type: "uuid", nullable: true })
  commissionUplineUserId !: string;

  @Column({ type: 'int', default: 0 })
  commissionUpline!: number;

  @Column({ type: 'int', default: 0 })
  commissionOwn !: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "superAgent", "agent"] , nullable: true })
  partnershipUplineType !: string | null; 

  @Column({ type: "uuid", nullable: true })
  partnershipUplineUserId !: string;

  @Column({ type: 'int', default: 0 })
  partnershipUpline !: number;

  @Column({ type: 'int', default: 0 })
  partnershipOwn !: number;


  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
  
}