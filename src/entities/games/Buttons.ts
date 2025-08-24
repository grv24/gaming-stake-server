import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Unique
} from "typeorm";

export interface PricePreferenceItem {
    priceLabel: string;
    priceValue: string;
}

@Entity({ name: "buttons" })
@Unique(["userId", "gameType"])
export class Buttons {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "uuid" })
    userId!: string;

    @Column({
        type: "jsonb",
        nullable: false,
        default: [
            { priceLabel: "+25", priceValue: "25" },
            { priceLabel: "+50", priceValue: "50" },
            { priceLabel: "+100", priceValue: "100" },
            { priceLabel: "+200", priceValue: "200" },
            { priceLabel: "+500", priceValue: "500" },
            { priceLabel: "+1000", priceValue: "1000" }
        ],
    })
    labelAndValues!: PricePreferenceItem[];

    @Column({
        type: "enum",
        enum: ["casino", "sports"],
    })
    gameType!: "casino" | "sports";


    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}