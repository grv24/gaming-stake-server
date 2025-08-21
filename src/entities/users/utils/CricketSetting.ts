import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Min } from 'class-validator';

@Entity('cricket_settings')
export class CricketSettings {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar" })
  user__type !: string;

  @Column({ default: false })
  isWhiteListed!: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.01 })
  min_Odds_To_Bet!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 24 })
  max_Odds_To_Bet!: number;

  @Column({ type: "varchar", nullable: true })
  sportId!: string;

  @Column({ default: 1 })
  @Min(1)
  betDelay!: number;

  @Column({ default: 1 })
  @Min(1)
  bookMakerDelay!: number;

  @Column({ default: 1 })
  @Min(1)
  sessionDelay!: number;

  @Column({ default: 100 })
  @Min(100)
  minMatchStake!: number;

  @Column({ default: 1 })
  maxMatchStake!: number;

  @Column({ default: 100 })
  @Min(100)
  minBookMakerStake!: number;

  @Column({ default: 1 })
  maxBookMakerStake!: number;

  @Column({ default: 100 })
  @Min(100)
  minSessionStake!: number;

  @Column({ default: 1 })
  maxSessionStake!: number;

  @Column({ default: 0 })
  maxProfit!: number;

  @Column({ default: 0 })
  maxLoss!: number;

  @Column({ default: 0 })
  sessionMaxProfit!: number;

  @Column({ default: 0 })
  sessionMaxLoss!: number;

  @Column({ default: 0 })
  minExposure!: number;

  @Column({ default: 0 })
  maxExposure!: number;

  @Column({ default: 0 })
  winningLimit!: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"], default: "total" })
  commissionToType !: string;

  @Column({ type: "uuid", nullable: true })
  commissionToUserId !: string;

  @Column({ type: 'int', default: 0 })
  matchCommission!: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"], default: "total" })
  partnershipToType !: string;

  @Column({ type: "uuid", nullable: true })
  partnershipToUserId !: string;

  @Column({ type: 'int', default: 0 })
  partnership !: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}