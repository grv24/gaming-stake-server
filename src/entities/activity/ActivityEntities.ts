import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_activities')
@Index(['userId', 'createdAt'])
@Index(['activityType', 'createdAt'])
@Index(['ipAddress', 'createdAt'])
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  userType!: string; // client, agent, admin, etc.

  @Column({ 
    type: 'enum', 
    enum: [
      'login', 'logout', 'bet_placed', 'bet_settled', 'deposit', 'withdraw',
      'password_change', 'profile_update', 'balance_check', 'casino_play',
      'sports_view', 'casino_view', 'settings_change', 'commission_view'
    ]
  })
  activityType!: string;

  @Column({ type: 'varchar', length: 255 })
  activityDescription!: string;

  @Column({ type: 'jsonb', nullable: true })
  activityData!: any; // Additional activity-specific data

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('bet_activities')
@Index(['userId', 'createdAt'])
@Index(['betType', 'createdAt'])
@Index(['status', 'createdAt'])
export class BetActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  userType!: string;

  @Column({ 
    type: 'enum', 
    enum: ['sports', 'casino']
  })
  betType!: string;

  @Column({ type: 'uuid', nullable: true })
  betId!: string; // Reference to SportBet or CasinoBet

  @Column({ type: 'varchar', length: 255 })
  eventId!: string; // Sports event or casino match ID

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  stakeAmount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  potentialWin!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualWin!: number;

  @Column({ 
    type: 'enum', 
    enum: ['placed', 'won', 'lost', 'cancelled', 'refunded']
  })
  status!: string;

  @Column({ type: 'jsonb', nullable: true })
  betDetails!: any; // Detailed bet information

  @Column({ type: 'jsonb', nullable: true })
  commission!: any; // Commission details

  @Column({ type: 'jsonb', nullable: true })
  exposure!: any; // Exposure details

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('session_activities')
@Index(['userId', 'createdAt'])
@Index(['sessionId', 'createdAt'])
export class SessionActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  userType!: string;

  @Column({ type: 'varchar', length: 100 })
  sessionId!: string;

  @Column({ type: 'varchar', length: 45 })
  ipAddress!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  isp!: string;

  @Column({ type: 'timestamp', nullable: true })
  loginTime!: Date;

  @Column({ type: 'timestamp', nullable: true })
  logoutTime!: Date;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  totalActivities!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalBetAmount!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('performance_metrics')
@Index(['metricType', 'createdAt'])
@Index(['endpoint', 'createdAt'])
export class PerformanceMetric {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ 
    type: 'enum', 
    enum: ['api_response_time', 'database_query_time', 'socket_connection', 'memory_usage', 'cpu_usage']
  })
  metricType!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  endpoint!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method!: string; // GET, POST, etc.

  @Column({ type: 'int', nullable: true })
  statusCode!: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  value!: number; // Metric value (e.g., response time in ms)

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit!: string; // ms, bytes, %, etc.

  @Column({ type: 'jsonb', nullable: true })
  metadata!: any; // Additional metric data

  @Column({ type: 'varchar', length: 100, nullable: true })
  groupId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

