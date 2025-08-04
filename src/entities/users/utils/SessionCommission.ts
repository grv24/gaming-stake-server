import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('session_commissions')
export class SessionCommission {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar" })
  user__type !: string;

  @Column({ type: "varchar", enum: ["soccer", "tennis", "cricket", "casino", "matka", "diamondCasino"] })
  sportType !: string;

  @Column({ type: "uuid", nullable: true })
  sportTypeId!: string;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] })
  commissionToType !: string;

  @Column({ type: "uuid", nullable: true })
  commissionToUserId !: string;

  @Column({ type: 'int', default: 0 })
  sessionCommission!: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}