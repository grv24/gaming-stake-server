import 'reflect-metadata';
import dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { connectRedis } from "./src/config/redisConfig";
import { initRedisPubSub } from './src/config/redisPubSub';
import { startCasinoCronJobs } from './src/cron/CasinoCronJob';
import { startSportCronJobs } from './src/cron/SportsCronJob';

// Import all entities
import { Developer } from './src/entities/users/DeveloperUser';
import { Whitelist } from './src/entities/whitelist/Whitelist';
import { TechAdmin } from './src/entities/users/TechAdminUser';
import { SoccerSettings } from './src/entities/users/utils/SoccerSetting';
import { TennisSettings } from './src/entities/users/utils/TennisSetting';
import { CricketSettings } from './src/entities/users/utils/CricketSetting';
import { CasinoSettings } from './src/entities/users/utils/CasinoSetting';
import { InternationalCasinoSettings } from './src/entities/users/utils/InternationalCasino';
import { MatkaSettings } from './src/entities/users/utils/MatkaSetting';
import { SuperMaster } from './src/entities/users/SuperMasterUser';
import { Master } from './src/entities/users/MasterUser';
import { SuperAgent } from './src/entities/users/SuperAgentUser';
import { Agent } from './src/entities/users/AgentUser';
import { MiniAdmin } from './src/entities/users/MiniAdminUser';
import { Admin } from './src/entities/users/AdminUser';
import { Client } from './src/entities/users/ClientUser';
import { AccountTrasaction } from './src/entities/Transactions/AccountTransactions';
import { DefaultCasino } from './src/entities/casino/DefaultCasino';
import { CasinoMatch } from './src/entities/casino/CasinoMatch';
import { CasinoBet } from './src/entities/casino/CasinoBet';

dotenv.config();

// Set environment variable to identify cron service context
process.env.CRON_SERVICE = 'true';

// Database Configuration for Cron Service (same as main server but with different name)
export const CronDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    entities: [
        Developer, 
        Whitelist, 
        TechAdmin, 
        SuperMaster,
        Master,
        SuperAgent,
        Agent,
        MiniAdmin,
        Admin,
        Client,
        SoccerSettings, 
        TennisSettings, 
        CricketSettings, 
        CasinoSettings, 
        InternationalCasinoSettings, 
        MatkaSettings,
        AccountTrasaction,
        DefaultCasino,
        CasinoMatch,
        CasinoBet
    ],
    synchronize: false, // Disable auto-sync for cron service
    logging: false, // Disable logging for cron service
    name: 'cron-service' // Unique name to avoid conflicts
});

const startCronService = async () => {
  try {
    console.log('🚀 Starting Cron Service...');
    
    // Initialize database connection
    await CronDataSource.initialize();
    console.log('✅ Database connected for cron service');

    // Initialize Redis
    await connectRedis();
    initRedisPubSub(); 
    console.log('✅ Redis connected for cron service');

    // Start cron jobs
    console.log('⏰ Starting cron jobs...');
    startCasinoCronJobs();
    startSportCronJobs();
    console.log('✅ Cron jobs started successfully');

    console.log('🎯 Cron service is running independently');
    console.log('📊 Monitoring:');
    console.log('   - Sports odds: Every 30 seconds');
    console.log('   - Casino data: Every 2 minutes');
    console.log('   - Batch processing: 5 casino types at a time');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('🛑 Shutting down cron service gracefully...');
      CronDataSource.destroy().then(() => {
        console.log('✅ Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('❌ Cron service startup failed:', error);
    process.exit(1);
  }
};

// Start the cron service
startCronService();
