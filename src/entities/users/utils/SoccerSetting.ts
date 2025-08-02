import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';
import { UserSettings } from './UserSetting';
import { MatchCommission } from './MatchCommission';
import { Partnership } from './Partnership';
import { DefaultSport } from './DefaultSport';

@Entity('soccer_settings')
export class SoccerSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ default: false })
  isWhiteListed!: boolean;

  @Column({ type: 'float', default: 1.01 })
  minOddsToBet!: number;

  @Column({ type: 'float', default: 24 })
  maxOddsToBet!: number;

  @Column({ nullable: true })
  sportId!: string;

  @ManyToOne(() => DefaultSport, sport => sport.soccerSettings)
  @JoinColumn({ name: 'sportId' })
  sport!: DefaultSport;

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

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true, unique: true })
  userSettingsId!: string;

  @OneToOne(() => UserSettings)
  @JoinColumn({ name: 'userSettingsId' })
  userSettings!: UserSettings;

  @Column({ nullable: true, unique: true })
  matchCommissionId!: string;

  @OneToOne(() => MatchCommission)
  @JoinColumn({ name: 'matchCommissionId' })
  matchCommission!: MatchCommission;

  @Column({ nullable: true, unique: true })
  partnershipId!: string;

  @OneToOne(() => Partnership)
  @JoinColumn({ name: 'partnershipId' })
  partnership!: Partnership;
}