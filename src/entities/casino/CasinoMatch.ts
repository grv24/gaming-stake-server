import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "casino_match" })
export class CasinoMatch {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", unique: true })
    mid!: String;

    @Column({ type: "varchar", length: 255 })
    casinoType!: string;

    @Column({ type: "varchar", nullable: true })
    winner!: string | null;

    @Column({ type: "jsonb", nullable: true })
    data: any;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
