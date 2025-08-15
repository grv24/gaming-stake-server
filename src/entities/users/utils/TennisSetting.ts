import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';

@Entity('tennis_settings')
export class TennisSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar" })
  user__type !: string;

  @Column({ default: false })
  isWhiteListed!: boolean;

  @Column({ type: 'float', default: 1.01 })
  minOddsToBet!: number;

  @Column({ type: 'float', default: 24 })
  maxOddsToBet!: number;

  @Column({ type: "uuid", nullable: true })
  sportId!: string;

  @Column({ default: 1 })
  betDelay!: number;

  @Column({ default: 1 })
  bookMakerDelay!: number;

  @Column({ type: 'float', default: 100 })
  minMatchStake!: number;

  @Column({ type: 'float', default: 100 })
  maxMatchStake!: number;

  @Column({ type: 'float', default: 100 })
  minBookMakerStake!: number;

  @Column({ type: 'float', default: 1 })
  maxBookMakerStake!: number;

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

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] , default: "total" })
  commissionToType !: string;

  @Column({ type: "uuid", nullable: true })
  commissionToUserId !: string;

  @Column({ type: 'int', default: 0 })
  matchCommission!: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] , default: "total" })
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