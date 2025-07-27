import { userTypeDefs } from './users/typeDefs';
import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  ${userTypeDefs}
`;
