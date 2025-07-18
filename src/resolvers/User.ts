import { Resolver, Query } from 'type-graphql';
import { Users } from '../entities/User';
import { AppDataSource } from '../server';

@Resolver()
export class UserResolver {
    @Query(() => [Users]) // needed Users to be decorated with @ObjectType
    async getUsers() {
        const userRepository = AppDataSource.getRepository(Users);
        return await userRepository.find();
    }
}
