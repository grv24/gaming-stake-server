import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn
} from 'typeorm';
import { BaseUser } from './BaseUser';

@Entity('admins')
export class Admin {
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

  @Column({ type: 'float', default: 10000000, name: 'ExposureLimit' })
  exposureLimit!: number;

  // Feature Access Permissions
  @Column({ type: 'boolean', default: false, name: 'featureAccessPermissions.whiteList' })
  whiteListAccess!: boolean;

  @Column({ type: 'boolean', default: false, name: 'featureAccessPermissions.depositWithdrawl' })
  depositWithdrawlAccess!: boolean;

  @Column({ type: 'boolean', default: false })
  canDeleteBets!: boolean;

  @Column({ type: 'boolean', default: false })
  canDeleteUsers!: boolean;

  @Column({ type: 'boolean', default: false })
  specialPermissions!: boolean;

  @Column({ type: 'boolean', default: false })
  enableMultipleLogin!: boolean;

  @Column({ type: 'boolean', default: false })
  autoSignUpFeature!: boolean;

  @Column({ type: 'boolean', default: false })
  displayUsersOnlineStatus!: boolean;

  @Column({ type: 'boolean', default: false })
  refundOptionFeature!: boolean;

  @Column({ type: 'boolean', default: false })
  canDeclareResultAsOperator!: boolean;

  // User Limits
  @Column({ type: 'int', default: 8 })
  allowedNoOfUsers!: number;

  @Column({ type: 'int', default: 0 })
  createdUsersCount!: number;

  // Commission Settings
  @Column({ type: 'boolean', default: true, name: 'commissionSettings.percentageWise' })
  percentageWiseCommission!: boolean;

  @Column({ type: 'boolean', default: false, name: 'commissionSettings.partnerShipWise' })
  partnerShipWiseCommission!: boolean;

  @Column({ type: 'boolean', default: true, name: 'commissionLenaYaDena.commissionLena' })
  commissionLena!: boolean;

  @Column({ type: 'boolean', default: false, name: 'commissionLenaYaDena.commissionDena' })
  commissionDena!: boolean;

  // Sports Settings
  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Soccer' })
  soccerSettings!: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Tennis' })
  tennisSettings!: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Cricket' })
  cricketSettings!: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Matka' })
  matkaSettings!: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Casino' })
  casinoSettings!: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.DiamondCasino' })
  diamondCasinoSettings!: any;
}
