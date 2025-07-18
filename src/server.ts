import 'reflect-metadata';
import dotenv from 'dotenv';
import app from './app';

dotenv.config();

import { DataSource } from 'typeorm';
// import { User } from './entities/User'; // Example entity

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    username: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
    entities: [],
    synchronize: true, 
});

const startServer = async () => {
    try {
        await AppDataSource.initialize();
        console.log('Connected to Postgres');

        const PORT = process.env.PORT || 4000;

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
        });
    } catch (error) {
        console.error('Database connection failed:', error);
    }
};

startServer();
