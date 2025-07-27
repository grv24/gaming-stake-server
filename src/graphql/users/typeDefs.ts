import { gql } from 'apollo-server-express';

export const userTypeDefs = gql`
  type User {
    id: String!
    name: String!
    email: String!
    createdAt: String!
  }

  type Query {
    users: [User!]!
  }
`;
