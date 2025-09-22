import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "casino_match_new" })
export class CasinoMatchNew {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "varchar", unique: true })
  mid!: String;

  @Column({ type: "varchar", length: 255, name: "casinotype" })
  casinoType!: string;

  @Column({ type: "varchar", nullable: true })
  winner!: string | null;

  @Column({ type: "jsonb", nullable: true })
  data: any;
  @Column({ type: "jsonb", nullable: true, default: null })
  result: any;
  @CreateDateColumn({ type: "timestamp", name: "createdat" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updatedat" })
  updatedAt!: Date;
}
