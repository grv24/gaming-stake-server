import prisma from '../../utils/prismaClient';

export const userResolvers = {
  Query: {
    users: async () => {
      return prisma.user.findMany();
    },
  },
};
