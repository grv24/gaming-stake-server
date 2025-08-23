import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "casino_bet" })
export class CasinoBet {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    userId!: String;

    @Column({ type: "varchar" })
    userType !: String;

    @Column({ type: "varchar", length: 255 })
    matchId!: string;

    @Column({ type: "jsonb", nullable: true })
    commission: any;

    @Column({ type: "jsonb", nullable: true })
    partnership: any;

    @Column({ type: "jsonb", nullable: true })
    exposure: any;

    @Column({ default: "pending" })
    status!: "pending" | "won" | "lost";

    @Column({ type: "jsonb", nullable: true })
    betData: any;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
