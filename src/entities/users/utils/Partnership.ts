import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToOne, JoinColumn } from 'typeorm';

@Entity('partnerships')
export class Partnership {

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: "uuid", unique: true })
  userId!: string;

  @Column({ type: "varchar" })
  user__type !: string;

  @Column({ type: "varchar", enum: ["soccer", "tennis", "cricket", "casino", "matka", "internationalCasino"] })
  sportType !: string;

  @Column({ type: "uuid", nullable: true })
  sportTypeId!: string;

  @Column({ type: "varchar", enum: ["techAdmin", "admin", "miniAdmin", "superMaster", "master", "client", "own", "total"] })
  partnershipToType !: string;

  @Column({ type: "uuid", nullable: true })
  partnershipToUserId !: string;

  @Column({ type: 'int', default: 0 })
  partnership !: number;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

}