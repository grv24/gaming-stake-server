// BaseUser.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { UserSettings } from './utils/UserSetting';
import { MatchCommission } from './utils/MatchCommission';
import { Partnership } from './utils/Partnership';
import { Client } from './ClientUser';

@Entity('users')
export class BaseUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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
  idIsActive!: boolean;

  @Column({ default: false })
  isAutoRegisteredUser!: boolean;

  @Column({ nullable: true })
  IpAddress!: string;

  @Column({ nullable: true })
  remarks!: string;

  @Column({ nullable: true })
  uplineId!: string;

  @ManyToOne(() => BaseUser)
  @JoinColumn({ name: 'uplineId' })
  upline!: BaseUser;

  @Column({ default: false })
  fancyLocked!: boolean;

  @Column({ default: false })
  bettingLocked!: boolean;

  @Column({ default: false })
  userLocked!: boolean;

  @Column({ default: false })
  closedAccounts!: boolean;

  @Column({ nullable: true })
  whiteListId!: string;

  @Column({ type: 'int', nullable: true, name: 'socialContacts.whatsappNumber' })
  whatsappNumber!: number;

  @Column({ nullable: true, name: 'websiteSettings.topBarRunningMessage' })
  topBarRunningMessage!: string;

  @Column({ type: 'json', nullable: true })
  loginReports: any;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ nullable: true })
  __type!: string;

  @OneToOne(() => UserSettings, userSettings => userSettings.baseUser)
  userSettings!: UserSettings;

  @OneToMany(() => MatchCommission, match => match.user)
  matchCommissions!: MatchCommission[];

  @OneToMany(() => Partnership, partner => partner.user)
  partnerships!: Partnership[];

  @OneToOne(() => Client, client => client.baseUser)
  client!: Client;
}
