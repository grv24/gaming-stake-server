import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('default_sports')
export class DefaultSport {
  
  @PrimaryGeneratedColumn('uuid')
  id !: string;

  @Column({ type: "varchar", unique: true })
  name !: string;

  @Column({ type:"varchar" , unique: true })
  code !: string;

  @Column({ type: "text", nullable: true })
  slug!: string | null;

  @Column({ default: true })
  isActive !: boolean;

  @CreateDateColumn()
  createdAt !: Date;

  @UpdateDateColumn()
  updatedAt !: Date;
}