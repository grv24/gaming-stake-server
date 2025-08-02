import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { BaseUser } from '../BaseUser';
import { SoccerSettings } from './SoccerSetting';

@Entity('partnerships')
export class Partnership {
  @PrimaryGeneratedColumn('uuid')
  id !: string;

  @Column({ type: 'float', default: 0 })
  partnership!: number;

  @Column({ default: 'percentage' })
  partnershipType!: string;

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

  @ManyToOne(() => BaseUser, user => user.partnerships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: BaseUser;

  @Column({ nullable: true, unique: true })
  soccerSettingsId!: string;

  @OneToOne(() => SoccerSettings)
  @JoinColumn({ name: 'soccerSettingsId' })
  soccerSettings!: SoccerSettings;
}