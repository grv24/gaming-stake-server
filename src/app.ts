import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import developerUserRouter from './routes/users/DeveloperRoutes';
import adminUserRouter from './routes/users/AdminRoutes';
import agentUserRouter from './routes/users/AgentRoutes';
import clientUserRouter from './routes/users/ClientRoutes';
import masterUserRouter from './routes/users/MasterRoutes';
import miniAdminUserRouter from './routes/users/MiniAdminRoutes';
import superAgentUserRouter from './routes/users/SuperAgentRoutes';
import superMasterUserRouter from './routes/users/SuperMasterRoutes';
import techAdminUserRouter from './routes/users/TechAdminRoutes';


const app: Application = express();

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(express.json());

// REST Routes
app.use('/api/v1/users/developers/', developerUserRouter);
app.use('/api/v1/users/admins/', adminUserRouter);
app.use('/api/v1/users/clients/', clientUserRouter);
app.use('/api/v1/users/agents/', agentUserRouter);
app.use('/api/v1/users/masters/', masterUserRouter);
app.use('/api/v1/users/super-masters/', superMasterUserRouter);
app.use('/api/v1/users/super-agents/', superAgentUserRouter);
app.use('/api/v1/users/mini-admins/', miniAdminUserRouter);
app.use('/api/v1/users/tech-admins/', techAdminUserRouter);


export default app;
