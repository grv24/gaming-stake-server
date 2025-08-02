import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { BaseUser } from './BaseUser';

@Entity('masters')
export class Master {
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
