import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

@Entity('login_reports')
export class LoginReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type:"varchar", unique: true })
  baseUserId!: string;

  @Column({ nullable: true })
  country!: string | null;

  @Column({ nullable: true })
  region!: string | null;

  @Column({ nullable: true })
  city!: string | null;

  @Column({ nullable: true })
  isp!: string | null;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'login_date', type: 'timestamp' })
  loginDate!: Date;

  @Column({ nullable: true })
  lat!: string | null;

  @Column({ nullable: true })
  lon!: string | null;

  @Column({ nullable: true })
  zip!: string | null;

}