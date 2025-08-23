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

    @Column({ type: "varchar", length: 255 })
    matchId!: string;

    @Column({ type: "varchar" })
    casinoType!: string;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column({ default: "pending" })
    status!: "pending" | "won" | "lost";

    @Column({ type: "jsonb", nullable: true })
    data: any;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
