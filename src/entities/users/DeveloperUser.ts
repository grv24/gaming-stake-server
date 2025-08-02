import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseUser } from './BaseUser';

@Entity('developers')
export class Developer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  baseUserId!: string;

  @OneToOne(() => BaseUser)
  @JoinColumn({ name: 'baseUserId' })
  baseUser!: BaseUser;

  @Column({ default: 0 })
  createdUsersCount!: number;

  @Column({ type: 'float', default: 10000000000, name: 'Balance' })
  balance!: number;

  @Column({ type: 'float', default: 10000000000, name: 'freeChips' })
  freeChips!: number;
}
