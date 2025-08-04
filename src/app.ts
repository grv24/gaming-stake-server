import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

import userRouter from './routes/users/UserRoutes';

const app: Application = express(); 

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(express.json());

// REST Routes
app.use('/api/v1/users', userRouter);


export default app;
