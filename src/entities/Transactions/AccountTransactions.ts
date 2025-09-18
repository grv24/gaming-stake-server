import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('accountTrasaction')
export class AccountTrasaction {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: "uuid" })
    uplineUserId!: string;

    @Column({ type: "uuid" })
    downlineUserId!: string;

    @Column({ type: "text" })
    remarks!: String;

    @Column({ type: "enum", enum: ["deposit", "withdraw","place-bet","settle-bet"] })
    type!: "deposit" | "withdraw" | "place-bet" | "settle-bet";

    @Column({ type: 'float' })
    amount!: number;

    @CreateDateColumn()
    createdAt !: Date;

    @UpdateDateColumn()
    updatedAt !: Date;
}
