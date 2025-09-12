import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Whitelist } from './Whitelist';
import { DefaultCasino } from '../casino/DefaultCasino';

@Entity({ name: 'whitelist_casino_mappings' })
export class WhitelistCasinoMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  whitelistId!: string;

  @Column({ type: 'uuid' })
  casinoId!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'json', nullable: true })
  customSettings!: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Whitelist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'whitelistId' })
  whitelist!: Whitelist;

  @ManyToOne(() => DefaultCasino, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'casinoId' })
  casino!: DefaultCasino;
}


