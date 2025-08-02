import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app: Application = express(); 

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(express.json());

// REST Routes
// app.use('/api', routes);


export default app;
