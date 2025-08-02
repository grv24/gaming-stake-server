import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  baseUserId!: string;

  @Column({ default: 0 })
  liability!: number;

  @Column({ default: 0, name: 'Balance' })
  balance!: number;

  @Column({ default: 0 })
  profitLoss!: number;

  @Column({ default: 0 })
  freeChips!: number;

  @Column({ default: 0 })
  totalSettledAmount!: number;

  @Column({ default: 0, name: 'Exposure' })
  exposure!: number;

  @Column({ default: 1000000, name: 'ExposureLimit' })
  exposureLimit!: number;

  @Column({ default: 0, name: 'AccountDetails.bonus.amount' })
  bonusAmount!: number;

  @Column({ default: 0, name: 'AccountDetails.bonus.wageringRequired' })
  bonusWageringRequired!: number;

  @Column({ default: 0, name: 'AccountDetails.bonus.wageringProgress' })
  bonusWageringProgress!: number;

  @Column({ nullable: true, name: 'AccountDetails.bonus.expiresAt', type: 'timestamp' })
  bonusExpiresAt!: Date;

  @Column({ default: false, name: 'AccountDetails.bonus.active' })
  bonusActive!: boolean;

  @Column({ default: false, name: 'featureAccessPermissions.depositWithdrawl' })
  depositWithdrawlAccess!: boolean;

  @Column({ default: false, name: 'permissions.canBypassCasinoBet' })
  canBypassCasinoBet!: boolean;

  @Column({ default: false, name: 'permissions.canBypassSportBet' })
  canBypassSportBet!: boolean;

  @Column({ type: 'json', nullable: true, name: 'casinoButtons' })
  casinoButtons: any;

  @Column({ type: 'json', nullable: true, name: 'gameButtons' })
  gameButtons: any;

  @Column({ default: true, name: 'commissionSettings.percentageWise' })
  percentageWiseCommission!: boolean;

  @Column({ default: false, name: 'commissionSettings.partnerShipWise' })
  partnerShipWiseCommission!: boolean;

  @Column({ default: true, name: 'commissionLenaYaDena.commissionLena' })
  commissionLena!: boolean;

  @Column({ default: false, name: 'commissionLenaYaDena.commissionDena' })
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
}
