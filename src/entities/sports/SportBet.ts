import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "sport_bet_updated" })
export class SportBet {

    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    userId!: String;

    @Column({ type: "varchar" })
    userType !: String;

    @Column({ type: "varchar", length: 255 })
    eventId!: string;

    @Column({ type: "varchar", length: 255 })
    sId!: string;

    @Column({ default: "pending" })
    status!: "pending" | "won" | "lost";

    @Column({ type: "jsonb", nullable: true })
    betData: any;

    @Column({ type: "varchar", length: 45, nullable: true })
    ipAddress!: string;

    @Column({ type: "varchar", length: 500, nullable: true })
    userAgent!: string;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}

