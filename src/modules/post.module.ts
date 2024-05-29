import { Module } from '@nestjs/common';
import { PostResolver } from '../resolvers/post.resolver';
import { PostService } from '../services/Post.service';

@Module({
  providers: [PostResolver, PostService],
})
export class PostModule {}
