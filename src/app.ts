import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import userRouter from "./routes/users/UserRoutes";
import developerUserRouter from './routes/users/DeveloperRoutes';
import adminUserRouter from './routes/users/AdminRoutes';
import agentUserRouter from './routes/users/AgentRoutes';
import clientUserRouter from './routes/users/ClientRoutes';
import masterUserRouter from './routes/users/MasterRoutes';
import miniAdminUserRouter from './routes/users/MiniAdminRoutes';
import superAgentUserRouter from './routes/users/SuperAgentRoutes';
import superMasterUserRouter from './routes/users/SuperMasterRoutes';
import techAdminUserRouter from './routes/users/TechAdminRoutes';
import whitelistRouter from './routes/whitelist/WhitelistRoutes';
import CasinoRouter from './routes/casino/CasinoRoutes';
import SportRouter from './routes/sports/SportRoutes';
import GamesRouter from './routes/games/GamesRoutes';

const app: Application = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(express.json());

app.use('/api/v1/users', userRouter);
app.use('/api/v1/users/developers/', developerUserRouter);
app.use('/api/v1/users/admins/', adminUserRouter);
app.use('/api/v1/users/clients/', clientUserRouter);
app.use('/api/v1/users/agents/', agentUserRouter);
app.use('/api/v1/users/masters/', masterUserRouter);
app.use('/api/v1/users/super-masters/', superMasterUserRouter);
app.use('/api/v1/users/super-agents/', superAgentUserRouter);
app.use('/api/v1/users/mini-admins/', miniAdminUserRouter);
app.use('/api/v1/users/tech-admins/', techAdminUserRouter);
app.use('/api/v1/whitelists', whitelistRouter);
app.use('/api/v1/casinos', CasinoRouter);
app.use('/api/v1/sports', SportRouter);
app.use('/api/v1/games', GamesRouter);

export default app;
