import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: 'int', nullable: true })
  whatsappNumber!: number;

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

  @Column({ default: 0})
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

  @Column({ type: "uuid" })
  soccerSettingId !: string;

  @Column({ type: "uuid" })
  tennisSettingId !: string;

  @Column({ type: "uuid" })
  cricketSettingId !: string;

  @Column({ type: "uuid" })
  matkaSettingId !: string;

  @Column({ type: "uuid" })
  casinoSettingId !: string;

  @Column({ type: "uuid" })
  diamondCasinoSettingId !: string;

  @CreateDateColumn()
  createdAt !: Date;

  @UpdateDateColumn()
  updatedAt !: Date;
}
