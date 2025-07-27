import { userResolvers } from './users/resolvers';
import { mergeResolvers } from '@graphql-tools/merge';

export const resolvers = mergeResolvers([
  userResolvers,
]);
