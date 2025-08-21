import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SoccerSettings } from './utils/SoccerSetting';
import { CricketSettings } from './utils/CricketSetting';
import { TennisSettings } from './utils/TennisSetting';
import { MatkaSettings } from './utils/MatkaSetting';
import { CasinoSettings } from './utils/CasinoSetting';
import { InternationalCasinoSettings } from './utils/InternationalCasino';

@Entity({ name: 'tech_admins' })
export class TechAdmin {
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

  @Column({ type: "varchar" })
  loginId!: string;

  @Column({ nullable: true })
  user_password!: string;

  @Column({ nullable: true })
  countryCode!: string;

  @Column({ type: "varchar", nullable: true })
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

  @Column({ type: "varchar", default: "techAdmin" })
  __type!: string;

  // Account Details
  @Column({ type: 'float', default: 0 })
  liability!: number;

  @Column({ type: 'float', default: 0 })
  balance!: number;

  @Column({ type: 'float', default: 0 })
  profitLoss!: number;

  @Column({ type: 'float', default: 0 })
  freeChips!: number;

  @Column({ type: 'float', default: 0 })
  totalSettledAmount!: number;

  // account kitne ka bana tha
  @Column({ type: 'float', default: 0 })
  creditRef!: number;

  // upper wale se kitna lena h ya dena h
  @Column({ type: 'float', default: 0 })
  uplineSettlement!: number;

  // kitna amountt laga h betting mein
  @Column({ type: 'float', default: 0 })
  exposure!: number;

  @Column({ type: 'float', default: 10000000 })
  exposureLimit!: number;

  @Column({ type: "bool", default: "false" })
  isPanelCommission !: boolean;

  // Feature Access Permissions
  @Column({ default: false })
  whiteListAccess!: boolean;

  @Column({ default: false })
  depositWithdrawlAccess!: boolean;

  @Column({ default: false })
  canDeleteBets!: boolean;

  @Column({ default: false })
  canDeleteUsers!: boolean;

  @Column({ default: false })
  specialPermissions!: boolean;

  @Column({ default: false })
  enableMultipleLogin!: boolean;

  @Column({ default: false })
  autoSignUpFeature!: boolean;

  @Column({ default: false })
  displayUsersOnlineStatus!: boolean;

  @Column({ default: false })
  refundOptionFeature!: boolean;

  @Column({ default: false })
  canDeclareResultAsOperator!: boolean;

  @Column({
    default: false
  })
  canChangeAvailableAdminPanels!: boolean;

  // Available Admin Panels
  @Column('text', { array: true, default: () => `'{Admin,MiniAdmin,SuperMaster,Master,SuperAgent,Agent,Client}'` })
  availableAdminPanels!: string[];

  // User Limits
  @Column({ default: 8 })
  allowedNoOfUsers!: number;

  @Column({ default: 0 })
  createdUsersCount!: number;

  // Commission Settings
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
  internationalCasinoSettingId !: string;

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

  @OneToOne(() => InternationalCasinoSettings)
  @JoinColumn({ name: 'internationalCasinoSettingId' })
  internationalCasinoSettings!: InternationalCasinoSettings;
}
