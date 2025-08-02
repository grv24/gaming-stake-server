import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SoccerSettings } from './SoccerSetting';

@Entity('default_sports')
export class DefaultSport {
  @PrimaryGeneratedColumn('uuid')
  id !: string;

  @Column({ unique: true })
  name !: string;

  @Column({ unique: true })
  code !: string;

  @Column({ default: true })
  isActive !: boolean;

  @CreateDateColumn()
  createdAt !: Date;

  @UpdateDateColumn()
  updatedAt !: Date;

  @OneToMany(() => SoccerSettings, settings => settings.sport)
  soccerSettings !: SoccerSettings[];
}
