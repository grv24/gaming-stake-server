import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'whitelists' })
export class Whitelist {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Domain Whitelisting
  @Column({ default: false })
  isDomainWhiteListedForSportScore!: boolean;

  @Column({ default: false })
  isDomainWhiteListedForSportVideos!: boolean;

  @Column({ default: false })
  isDomainWhiteListedForCasinoVideos!: boolean;

  @Column({ default: false })
  isDomainWhiteListedForIntCasinoGames!: boolean;

  // URLs
  @Column({ default: '' })
  TechAdminUrl!: string;

  @Column({ default: '' })
  AdminUrl!: string;

  @Column({ default: '' })
  ClientUrl!: string;

  @Column({ default: '' })
  CommonName!: string;

  @Column({ default: '' })
  websiteTitle!: string;

  // Meta Tags
  @Column({ type: 'json', nullable: true })
  websiteMetaTags!: any;

  // Website Theme ( client )
  @Column({ default: '#0D7A8E' })
  primaryBackground!: string;

  @Column({ default: '#0D7A8E' })
  primaryBackground90!: string;

  @Column({ default: '#04303e' })
  secondaryBackground!: string;

  @Column({ default: '#AE4600B3' })
  secondaryBackground70!: string;

  @Column({ default: '#AE4600E6' })
  secondaryBackground85!: string;

  @Column({ default: '#FFFFFF' })
  textPrimary!: string;

  @Column({ default: '#CCCCCC' })
  textSecondary!: string;

  // Sports Settings
  @Column("text", { array: true, default: ['Back', 'Lay'] })
  matchOdd!: string[];

  @Column("text", { array: true, default: [['b3', 'b2', 'b1'], ['l1', 'l2', 'l3']] })
  matchOddOptions!: string[][];

  @Column("text", { array: true, default: ['Back', 'Lay'] })
  bookMakerOdd!: string[];

  @Column("text", { array: true, default: ['No', 'Yes'] })
  normalOdd!: string[];

  // Refund Options
  @Column({ type: "boolean", default: false })
  refundOptionIsActive!: boolean;

  @Column({ type: 'float', default: 0 })
  refundPercentage!: number;

  @Column({ type: 'float', default: 0 })
  refundLimit!: number;

  @Column({ type: 'float', default: 100 })
  minDeposit!: number;

  // Website Access Settings
  @Column({ type: "boolean", default: false })
  autoSignUpFeature!: boolean;

  @Column({ type: "text", nullable: true })
  autoSignUpAssignedUplineId!: string | null;

  @Column({ type: "boolean", default: false })
  whatsappNumber!: boolean;

  @Column({ type: "text", default: '' })
  googleAnalyticsTrackingId!: string;

  @Column({ type: "boolean", default: false })
  loginWithDemoIdFeature!: boolean;

  // Status
  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", default: "" })
  Logo!: string;

  @Column({ type: "uuid" })
  createdById!: string;

  // Timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
