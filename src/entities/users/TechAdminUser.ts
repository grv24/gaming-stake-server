import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseUser } from './BaseUser';

@Entity({ name: 'tech_admins' })
export class TechAdmin {
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

  @Column({
    default: false,
    name: 'featureAccessPermissions.canChangeAvaialbleAdminPanels',
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
  @Column({ default: true, name: 'commissionSettings.percentageWise' })
  percentageWiseCommission!: boolean;

  @Column({ default: false, name: 'commissionSettings.partnerShipWise' })
  partnerShipWiseCommission!: boolean;

  @Column({ default: true, name: 'commissionLenaYaDena.commissionLena' })
  commissionLena!: boolean;

  @Column({ default: false, name: 'commissionLenaYaDena.commissionDena' })
  commissionDena!: boolean;

  // Sports Settings (JSON)
  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Soccer' })
  soccerSettings?: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Tennis' })
  tennisSettings?: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Cricket' })
  cricketSettings?: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Matka' })
  matkaSettings?: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.Casino' })
  casinoSettings?: any;

  @Column({ type: 'json', nullable: true, name: 'sportsSettings.DiamondCasino' })
  diamondCasinoSettings?: any;
}
