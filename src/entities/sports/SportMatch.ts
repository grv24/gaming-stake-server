import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "sport_match" })
export class SportMatch {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar", unique: true })
    mid!: String;

    @Column({ type: "varchar", length: 255 })
    sportType!: string;

    @Column({ type: "varchar", nullable: true })
    winner!: string | null;

    @Column({ type: "jsonb", nullable: true })
    data: any;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
