import express from 'express'; 
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import { typeDefs } from './graphql/rootTypeDefs';
import { resolvers } from './graphql/rootResolvers';
import userRoutes from './routes/userRoutes';
import prisma from './utils/prismaClient'; 

dotenv.config();

const app: any = express();
app.use(cors());
app.use(express.json());

// REST
app.use('/api', userRoutes);

// DB Connect before GraphQL init
async function connectToDB() {
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (err) {
    console.error('Failed to connect to DB:', err);
    process.exit(1);
  }
}

// GraphQL init
async function initGraphQL() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });
}

(async function bootstrap() {
  await connectToDB();    // Connect DB first
  await initGraphQL();    // Then start Apollo
})();

export default app;
