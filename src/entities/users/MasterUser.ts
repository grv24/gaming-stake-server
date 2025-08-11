import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
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

  @Column({ type: "varchar", default: "master" })
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

  @Column({ type: 'float', default: 0 })
  exposure!: number;

  @Column({ type: 'float', default: 1000000 })
  exposureLimit!: number;

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

  @Column({ type: "uuid" , nullable: true})
  tennisSettingId !: string;

  @Column({ type: "uuid" , nullable: true})
  cricketSettingId !: string;

  @Column({ type: "uuid" , nullable: true})
  matkaSettingId !: string;

  @Column({ type: "uuid" , nullable: true})
  casinoSettingId !: string;

  @Column({ type: "uuid" , nullable: true})
  diamondCasinoSettingId !: string;

  @CreateDateColumn()
  createdAt !: Date;

  @UpdateDateColumn()
  updatedAt !: Date;
}