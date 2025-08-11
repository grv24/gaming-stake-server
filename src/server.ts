import 'reflect-metadata';
import dotenv from 'dotenv';
import http from 'http'; 
import { setupSocket } from './socket/socketHandler';
import { DataSource } from 'typeorm';
import { Developer } from './entities/users/DeveloperUser';
import { Whitelist } from './entities/whitelist/Whitelist';
import { TechAdmin } from './entities/users/TechAdminUser';
import { SoccerSettings } from './entities/users/utils/SoccerSetting';
import { TennisSettings } from './entities/users/utils/TennisSetting';
import { CricketSettings } from './entities/users/utils/CricketSetting';
import { CasinoSettings } from './entities/users/utils/CasinoSetting';
import { DiamondCasinoSettings } from './entities/users/utils/DiamondCasino';
import { MatkaSettings } from './entities/users/utils/MatkaSetting';
import app from './app';

dotenv.config();

// Database Configuration
export const AppDataSource = new DataSource({
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
        SoccerSettings, 
        TennisSettings, 
        CricketSettings, 
        CasinoSettings, 
        DiamondCasinoSettings, 
        MatkaSettings
    ],
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
});

const startServer = async () => {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    const PORT = process.env.PORT || 4000;
    const server = http.createServer(app);
    
    // Setup Socket.IO
    const io = setupSocket(server);
    
    // Make io accessible in routes
    app.set('socketio', io);
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        AppDataSource.destroy().then(() => {
          console.log('Database connection closed');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
};


startServer();

// import 'reflect-metadata';
// import dotenv from 'dotenv';
// import http from 'http'; 
// import app from './app';
// import { setupSocket } from './socket/socketHandler'; 

// dotenv.config();

// import { DataSource } from 'typeorm';
// import { Developer } from './entities/users/DeveloperUser';
// import { Whitelist } from './entities/whitelist/Whitelist';
// import { TechAdmin } from './entities/users/TechAdminUser';
// import { SoccerSettings } from './entities/users/utils/SoccerSetting';
// import { TennisSettings } from './entities/users/utils/TennisSetting';
// import { CricketSettings } from './entities/users/utils/CricketSetting';
// import { CasinoSettings } from './entities/users/utils/CasinoSetting';
// import { DiamondCasinoSettings } from './entities/users/utils/DiamondCasino';
// import { MatkaSettings } from './entities/users/utils/MatkaSetting';

// export const AppDataSource = new DataSource({
//     type: 'postgres',
//     host: process.env.POSTGRES_HOST,
//     port: Number(process.env.POSTGRES_PORT),
//     username: process.env.POSTGRES_USERNAME,
//     password: process.env.POSTGRES_PASSWORD,
//     database: process.env.POSTGRES_DATABASE,
//     entities: [Developer, Whitelist, TechAdmin, SoccerSettings, TennisSettings, CricketSettings, CasinoSettings, DiamondCasinoSettings, MatkaSettings],
//     synchronize: true, 
// });

// const startServer = async () => {
//     try {
//         await AppDataSource.initialize();
//         console.log('Connected to Postgres');
//         const PORT = process.env.PORT || 4000;
//         const server = http.createServer(app);
//         setupSocket(server);
//         server.listen(PORT, () => {
//             console.log(`Server running on port ${PORT}`);
//         });

//     } catch (error) {
//         console.error('Database connection failed:', error);
//     }
// };

// startServer();