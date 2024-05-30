import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { join } from 'path';

export const GraphQLModuleConfig = GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  playground: false,
  autoSchemaFile: true,
  plugins: [ApolloServerPluginLandingPageLocalDefault()],
  context: ({ req }) => ({ user: req['user'] }),
});
