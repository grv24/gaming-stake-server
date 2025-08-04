import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  OneToOne,
} from 'typeorm';

@Entity('masters')
export class Master {
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
  salt!: string;

  @Column({ nullable: true })
  user_password!: string;

  @Column({ nullable: true })
  encry_password!: string;

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

  @Column({ type: 'int', nullable: true })
  whatsappNumber!: number;

  @Column({ type: "text", nullable: true })
  topBarRunningMessage!: string;

  @Column({ nullable: true })
  __type!: string;

  // Account Details
  @Column({ type: 'float', default: 0 })
  liability!: number;

  @Column({ name: 'Balance', type: 'float', default: 0 })
  balance!: number;

  @Column({ type: 'float', default: 0 })
  profitLoss!: number;

  @Column({ type: 'float', default: 0 })
  freeChips!: number;

  @Column({ type: 'float', default: 0 })
  totalSettledAmount!: number;

  @Column({ name: 'Exposure', type: 'float', default: 0 })
  exposure!: number;

  @Column({ name: 'ExposureLimit', type: 'float', default: 1000000 })
  exposureLimit!: number;

  // Feature Access Permissions
  @Column({ name: 'featureAccessPermissions.whiteList', default: false })
  whiteListAccess!: boolean;

  @Column({ name: 'featureAccessPermissions.depositWithdrawl', default: false })
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

  // User Limits
  @Column({ default: 8 })
  allowedNoOfUsers!: number;

  @Column({ default: 0 })
  createdUsersCount!: number;

  // Commission Settings
  @Column({ name: 'commissionSettings.percentageWise', default: true })
  percentageWiseCommission!: boolean;

  @Column({ name: 'commissionSettings.partnerShipWise', default: false })
  partnerShipWiseCommission!: boolean;

  @Column({ name: 'commissionLenaYaDena.commissionLena', default: true })
  commissionLena!: boolean;

  @Column({ name: 'commissionLenaYaDena.commissionDena', default: false })
  commissionDena!: boolean;

  // Sports Settings (JSON)
  @Column({ name: 'sportsSettings.Soccer', type: 'json', nullable: true })
  soccerSettings!: any;

  @Column({ name: 'sportsSettings.Tennis', type: 'json', nullable: true })
  tennisSettings!: any;

  @Column({ name: 'sportsSettings.Cricket', type: 'json', nullable: true })
  cricketSettings!: any;

  @Column({ name: 'sportsSettings.Matka', type: 'json', nullable: true })
  matkaSettings!: any;

  @Column({ name: 'sportsSettings.Casino', type: 'json', nullable: true })
  casinoSettings!: any;

  @Column({ name: 'sportsSettings.DiamondCasino', type: 'json', nullable: true })
  diamondCasinoSettings!: any;
}
