import { Mutation, Query } from '@nestjs/graphql';
import { PostService } from '../services/Post.service';

export class PostResolver {
  constructor(private readonly postService: PostService) {}

  @Query(() => String)
  findAll() {
    return 'hola';
  }
}
