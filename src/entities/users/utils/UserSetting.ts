import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { BaseUser } from '../BaseUser';
import { SoccerSettings } from './SoccerSetting';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  baseUserId!: string;

  @OneToOne(() => BaseUser, baseUser => baseUser.userSettings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'baseUserId' })
  baseUser!: BaseUser;

  @Column({ nullable: true })
  soccerSettingsId!: string;

  @OneToOne(() => SoccerSettings)
  @JoinColumn({ name: 'soccerSettingsId' })
  soccerSettings!: SoccerSettings;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}