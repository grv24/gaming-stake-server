import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseUser } from '../BaseUser';
import { SoccerSettings } from './SoccerSetting';

@Entity('match_commissions')
export class MatchCommission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'float', default: 0 })
  matchCommission!: number;

  @Column({ default: 'percentage' })
  commissionType!: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column()
  userType!: string;

  @Column({ default: 0 })
  hierarchyLevel!: number;

  @Column({ default: false })
  isDefault!: boolean;

  @Column({ nullable: true })
  appliesToUserType!: string;

  @Column({ nullable: true })
  appliesToUserId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => BaseUser, user => user.matchCommissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: BaseUser;

  @Column({ nullable: true, unique: true })
  soccerSettingsId!: string;

  @OneToOne(() => SoccerSettings)
  @JoinColumn({ name: 'soccerSettingsId' })
  soccerSettings!: SoccerSettings;
}