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
    eventId!: String;

    @Column({ type: "varchar", unique: true })
    eventName!: String;

    @Column({ type: "varchar", length: 255 })
    sportType!: string;

    @Column({ type: "jsonb", default: "[]" })
    categories!: Array<{
        marketName: string;
        marketType: string;
        marketId?: string;
        sid?: string;
        resultData?: any;
    }>;

    // @Column({ type: "varchar", nullable: true })
    // winner!: string | null;

    // @Column({ type: "jsonb", nullable: true })
    // resultData: any;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
