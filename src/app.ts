import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
// import routes from './routes';
import { UserResolver } from './resolvers/User';

const app: Application = express(); 

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(helmet());
app.use(express.json());

// REST Routes
// app.use('/api', routes);

const setupGraphQL = async () => {
    const schema = await buildSchema({
        resolvers: [UserResolver],
        validate: false, 
    });

    const apolloServer = new ApolloServer({
        schema,
        context: ({ req, res }) => ({ req, res }),
    });

    await apolloServer.start();
    apolloServer.applyMiddleware({ app: app as any, path: '/graphql', cors: false });
};

setupGraphQL();

export default app;
