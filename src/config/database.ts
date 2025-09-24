import "reflect-metadata";
import { DataSource } from "typeorm";
import dotenv from "dotenv";

// Import all entities
import { Developer } from "../entities/users/DeveloperUser";
import { Whitelist } from "../entities/whitelist/Whitelist";
import { TechAdmin } from "../entities/users/TechAdminUser";
import { SoccerSettings } from "../entities/users/utils/SoccerSetting";
import { TennisSettings } from "../entities/users/utils/TennisSetting";
import { CricketSettings } from "../entities/users/utils/CricketSetting";
import { CasinoSettings } from "../entities/users/utils/CasinoSetting";
import { InternationalCasinoSettings } from "../entities/users/utils/InternationalCasino";
import { MatkaSettings } from "../entities/users/utils/MatkaSetting";
import { SuperMaster } from "../entities/users/SuperMasterUser";
import { Master } from "../entities/users/MasterUser";
import { SuperAgent } from "../entities/users/SuperAgentUser";
import { Agent } from "../entities/users/AgentUser";
import { MiniAdmin } from "../entities/users/MiniAdminUser";
import { Admin } from "../entities/users/AdminUser";
import { Client } from "../entities/users/ClientUser";
import { AccountTrasaction } from "../entities/Transactions/AccountTransactions";
import { DefaultCasino } from "../entities/casino/DefaultCasino";
import { CasinoBet } from "../entities/casino/CasinoBet";
import { Buttons } from "../entities/games/Buttons";
import { SportBet } from "../entities/sports/SportBet";
import { CasinoMatchNew } from "../entities/casino/CasinoMatchNew";
import { WhitelistCasinoMapping } from "../entities/whitelist/WhitelistCasinoMapping";
import { UserActivity, BetActivity, SessionActivity, PerformanceMetric } from "../entities/activity/ActivityEntities";
import { SportMatch } from "../entities/sports/SportMatch";
import { CommissionTransaction } from "../entities/CommissionTransaction";
import { PaymentGateway } from "../entities/payment/PaymentGateway";
import { DepositRequest } from "../entities/payment/DepositRequest";
import { FileUpload } from "../entities/payment/FileUpload";
import { GatewayAssignment } from "../entities/payment/GatewayAssignment";

dotenv.config();

// All entities array - centralized definition
export const ALL_ENTITIES = [
  // User hierarchy
  Developer,
  TechAdmin,
  SuperMaster,
  Master,
  SuperAgent,
  Agent,
  MiniAdmin,
  Admin,
  Client,
  // System entities
  Whitelist,
  AccountTrasaction,
  // Casino entities
  DefaultCasino,
  CasinoBet,
  CasinoMatchNew,
  // Settings entities
  SoccerSettings,
  TennisSettings,
  CricketSettings,
  CasinoSettings,
  InternationalCasinoSettings,
  MatkaSettings,
  // Game entities
  Buttons,
  SportBet,
  SportMatch,
  // Whitelist mapping
  WhitelistCasinoMapping,
  // Activity entities
  UserActivity,
  BetActivity,
  SessionActivity,
  PerformanceMetric,
  // Commission
  CommissionTransaction,
  // Payment gateway
  PaymentGateway,
  DepositRequest,
  FileUpload,
  GatewayAssignment
];

// Main application database configuration
export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: ALL_ENTITIES,
  synchronize: false, // Disable auto-sync to prevent hanging
  logging: process.env.NODE_ENV === "development",
  connectTimeoutMS: 30000, // 30 second timeout
});

// Cron service database configuration (subset of entities)
export const CronDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [
    // User hierarchy - for authentication and authorization checks
    Developer,
    TechAdmin,
    SuperMaster,
    Master,
    SuperAgent,
    Agent,
    MiniAdmin,
    Admin,
    Client,
    // System entities - for whitelist and transaction tracking
    Whitelist,
    AccountTrasaction,
    // Casino entities - for game data and betting operations
    DefaultCasino,
    CasinoBet,
    // Settings entities - for configuration management
    SoccerSettings,
    TennisSettings,
    CricketSettings,
    CasinoSettings,
    InternationalCasinoSettings,
    MatkaSettings,
    CasinoMatchNew,
    WhitelistCasinoMapping,
    // Sport entities
    SportMatch
  ],
  synchronize: false, // Disable auto-sync for safety in production
  logging: false, // Disable TypeORM logging to reduce noise
  name: "cron-service", // Unique connection name to avoid conflicts
});

// Debug/utility database configuration (minimal entities)
export const DebugDataSource = new DataSource({
  type: "postgres",
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
  username: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [
    TechAdmin,
    Admin,
    Client,
    AccountTrasaction
  ],
  synchronize: false,
  logging: false,
  name: "debug-service"
});
