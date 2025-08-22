import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity({ name: "default_casino" })
export class DefaultCasino {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "int" })
    gameId!: number;

    @Column({ type: "varchar", length: 255 })
    gameName!: string;

    @Column({ type: "varchar", length: 100 })
    category!: string;

    @Column({ type: "varchar", length: 100 })
    provider!: string;

    @Column({ type: "varchar", length: 500 })
    gameTvLink!: string;

    @Column({ type: "varchar", length: 100 })
    slug!: string;

    @Column({ type: "int", default: 0 })
    __v!: number;

    @Column({ type: "varchar", length: 500, nullable: true })
    gameIcon?: string;

    @CreateDateColumn({ type: "timestamp" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp" })
    updatedAt!: Date;
}
