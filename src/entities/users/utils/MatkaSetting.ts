import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, ManyToOne } from 'typeorm';

@Entity('matka_settings')
export class MatkaSettings {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar" })
  user__type !: string;

  @Column({ default: false })
  isWhiteListed!: boolean;

  @Column({ type: 'float', default: 1.01 })
  minOddsToBet!: number;

  @Column({ type: 'float', default: 24 })
  maxOddsToBet!: number;

  @Column({ default: 1 })
  betDelay!: number;

  @Column({ type: 'float', default: 100 })
  minMatchStake!: number;

  @Column({ type: 'float', default: 100 })
  maxMatchStake!: number;

  @Column({ type: 'float', default: 0 })
  maxProfit!: number;

  @Column({ type: 'float', default: 0 })
  maxLoss!: number;

  @Column({ type: 'float', default: 0 })
  minExposure!: number;

  @Column({ type: 'float', default: 0 })
  maxExposure!: number;

  @Column({ type: 'float', default: 0 })
  winningLimit!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}