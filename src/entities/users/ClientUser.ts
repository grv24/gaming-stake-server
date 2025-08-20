import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SoccerSettings } from './utils/SoccerSetting';
import { CricketSettings } from './utils/CricketSetting';
import { TennisSettings } from './utils/TennisSetting';
import { MatkaSettings } from './utils/MatkaSetting';
import { CasinoSettings } from './utils/CasinoSetting';
import { DiamondCasinoSettings } from './utils/DiamondCasino';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", nullable: true })
  uplineId!: string;

  @Column({ type: "uuid" })
  whiteListId!: string;

  // nahi pata
  @Column({ nullable: true })
  groupID!: string;

  @Column({ nullable: true })
  transactionPassword!: string;

  @Column({ nullable: true })
  referallCode!: string;

  @Column({ length: 32, nullable: true })
  userName!: string;

  @Column({ unique: true })
  loginId!: string;

  @Column({ nullable: true })
  user_password!: string;

  @Column({ nullable: true })
  countryCode!: string;

  @Column({ nullable: true })
  mobile!: string;

  @Column({ default: false })
  isAutoRegisteredUser!: boolean;

  @Column({ nullable: true })
  IpAddress!: string;

  @Column({ nullable: true })
  remarks!: string;

  @Column({ default: false })
  fancyLocked!: boolean;

  @Column({ default: false })
  bettingLocked!: boolean;

  @Column({ default: false })
  userLocked!: boolean;

  // closedAccounts -> isActive
  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: 'varchar', nullable: true })
  whatsappNumber!: string;

  @Column({ type: "text", nullable: true })
  topBarRunningMessage!: string;

  @Column({ type: "varchar", default: "client" })
  __type!: string;

  @Column({ default: 0 })
  liability!: number;

  @Column({ default: 0 })
  balance!: number;

  @Column({ default: 0 })
  profitLoss!: number;

  @Column({ default: 0 })
  freeChips!: number;

  @Column({ default: 0 })
  totalSettledAmount!: number;

  // account kitne ka bana tha
  @Column({ type: 'float', default: 0 })
  creditRef!: number;

  // upper wale se kitna lena h ya dena h
  @Column({ type: 'float', default: 0 })
  uplineSettlement!: number;

  @Column({ default: 0 })
  exposure!: number;

  @Column({ default: 1000000 })
  exposureLimit!: number;

  @Column({ default: 0 })
  bonusAmount!: number;

  @Column({ default: 0 })
  bonusWageringRequired!: number;

  @Column({ default: 0 })
  bonusWageringProgress!: number;

  @Column({ nullable: true })
  bonusExpiresAt!: Date;

  @Column({ default: false })
  bonusActive!: boolean;

  @Column({ default: false })
  depositWithdrawlAccess!: boolean;

  @Column({ default: false })
  canBypassCasinoBet!: boolean;

  @Column({ default: false })
  canBypassSportBet!: boolean;

  @Column({ type: 'json' })
  casinoButtons: any;

  @Column({ type: 'json' })
  gameButtons: any;

  @Column({ default: true })
  percentageWiseCommission!: boolean;

  @Column({ default: false })
  partnerShipWiseCommission!: boolean;

  @Column({ default: true })
  commissionLena!: boolean;

  @Column({ default: false })
  commissionDena!: boolean;

  @Column({ type: "uuid", nullable: true })
  soccerSettingId !: string;

  @Column({ type: "uuid", nullable: true })
  tennisSettingId !: string;

  @Column({ type: "uuid", nullable: true })
  cricketSettingId !: string;

  @Column({ type: "uuid", nullable: true })
  matkaSettingId !: string;

  @Column({ type: "uuid", nullable: true })
  casinoSettingId !: string;

  @Column({ type: "uuid", nullable: true })
  diamondCasinoSettingId !: string;

    @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] , default: "total" })
  commissionToType !: string;

  @Column({ type: "uuid", nullable: true })
  commissionToUserId !: string;

  @Column({ type: 'int', default: 0 })
  matchCommission!: number;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] , default: "total"  })
  partnershipToType !: string;

  @Column({ type: "uuid", nullable: true })
  partnershipToUserId !: string;

  @Column({ type: 'int', default: 0 })
  partnership !: number;

  @CreateDateColumn()
  createdAt !: Date;

  @UpdateDateColumn()
  updatedAt !: Date;

  @OneToOne(() => SoccerSettings)
  @JoinColumn({ name: 'soccerSettingId' })
  soccerSettings!: SoccerSettings;

  @OneToOne(() => CricketSettings)
  @JoinColumn({ name: 'cricketSettingId' })
  cricketSettings!: CricketSettings;

  @OneToOne(() => TennisSettings)
  @JoinColumn({ name: 'tennisSettingId' })
  tennisSettings!: TennisSettings;

  @OneToOne(() => MatkaSettings)
  @JoinColumn({ name: 'matkaSettingId' })
  matkaSettings!: MatkaSettings;

  @OneToOne(() => CasinoSettings)
  @JoinColumn({ name: 'casinoSettingId' })
  casinoSettings!: CasinoSettings;

  @OneToOne(() => DiamondCasinoSettings)
  @JoinColumn({ name: 'diamondCasinoSettingId' })
  diamondCasinoSettings!: DiamondCasinoSettings;
}
