import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('developers')
export class Developer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 32, nullable: true })
  userName!: string;

  @Column({ unique: true })
  loginId!: string;

  @Column({ nullable: true })
  salt!: string;

  @Column({ type: "text" })
  userPassword!: string;

  @Column({ nullable: true })
  encryPassword!: string;
  
  // closedAccounts -> isActive
  @Column({ default: false })
  isActive!: boolean;

  @Column({ type: "varchar", default: "developer" })
  __type!: string;

  @Column({ default: 0 })
  createdUsersCount!: number;

  @Column({ type: 'float', default: 10000000000, name: 'Balance' })
  balance!: number;

  @Column({ type: 'float', default: 10000000000, name: 'freeChips' })
  freeChips!: number;
}
