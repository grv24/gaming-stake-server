import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseUser } from './BaseUser';

@Entity('super_masters')
export class SuperMaster {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  baseUserId!: string;

  @OneToOne(() => BaseUser)
  @JoinColumn({ name: 'baseUserId' })
  baseUser!: BaseUser;

  // Account Details
  @Column({ type: 'float', default: 0 })
  liability!: number;

  @Column({ type: 'float', default: 0, name: 'Balance' })
  balance!: number;

  @Column({ type: 'float', default: 0 })
  profitLoss!: number;

  @Column({ type: 'float', default: 0 })
  freeChips!: number;

  @Column({ type: 'float', default: 0 })
  totalSettledAmount!: number;

  @Column({ type: 'float', default: 0, name: 'Exposure' })
  exposure!: number;

  @Column({ type: 'float', default: 1000000, name: 'ExposureLimit' })
  exposureLimit!: number;

  // Feature Access Permissions
  @Column({ default: false, name: 'featureAccessPermissions.whiteList' })
  whiteListAccess!: boolean;

  @Column({ default: false, name: 'featureAccessPermissions.depositWithdrawl' })
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
  @Column({ type: 'int', default: 8 })
  allowedNoOfUsers!: number;

  @Column({ type: 'int', default: 0 })
  createdUsersCount!: number;

  // Commission Settings
  @Column({ default: true, name: 'commissionSettings.percentageWise' })
  percentageWiseCommission!: boolean;

  @Column({ default: false, name: 'commissionSettings.partnerShipWise' })
  partnerShipWiseCommission!: boolean;

  @Column({ default: true, name: 'commissionLenaYaDena.commissionLena' })
  commissionLena!: boolean;

  @Column({ default: false, name: 'commissionLenaYaDena.commissionDena' })
  commissionDena!: boolean;

  // Sports Settings (JSON Columns)
  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Soccer' })
  soccerSettings!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Tennis' })
  tennisSettings!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Cricket' })
  cricketSettings!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Matka' })
  matkaSettings!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Casino' })
  casinoSettings!: Record<string, any> | null;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.DiamondCasino' })
  diamondCasinoSettings!: Record<string, any> | null;
}
