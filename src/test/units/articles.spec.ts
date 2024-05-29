import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArticleEntity } from '../../models/tables/article.entity';
import { TypeOrmModuleOptions } from '../../config/typeorm';
import { ArticlesController } from '../../controllers/articles.controller';
import { ArticlesService } from '../../providers/articles.service';
import { ArticlesModule } from '../../modules/articles.module';
import { UserEntity } from '../../models/tables/user.entity';
import { generateRandomNumber } from '../../utils/generate-random-number';
import { CommentEntity } from '../../models/tables/comment.entity';
import { ArticleType } from '../../types';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('Article Entity', () => {
  let controller: ArticlesController;
  let service: ArticlesService;

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRootAsync(TypeOrmModuleOptions),
        TypeOrmModule.forFeature([ArticleEntity]),
        ConfigModule.forRoot({ isGlobal: true }),
        ArticlesModule,
      ],
      controllers: [],
      providers: [],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
    controller = module.get<ArticlesController>(ArticlesController);
  });

  describe('0. 테스트 환경을 확인합니다.', () => {
    it('0-1. Service와 Controller 가 정의되어야 합니다.', async () => {
      assert.notStrictEqual(controller, undefined);
      assert.notStrictEqual(service, undefined);
    });
  });

  describe('GET api/v1/articles', () => {
    describe('리턴 값에 대한 검증', () => {
      let reader: UserEntity;

      /**
       * response
       */
      let list: ArticleType.Element[] = [];
      let count: number = 0;
      before(async () => {
        const readerMetadata = generateRandomNumber(1000, 9999, true);

        reader = await UserEntity.save({
          name: readerMetadata,
          nickname: readerMetadata,
          password: readerMetadata,
        });

        const response = await service.read(reader.id, { page: 1, limit: 10 }, {});
        list = response.list;
        count = response.count;
      });

      it('게시글은 페이지네이션 형태로 작성되어야 한다.', async () => {
        assert.strictEqual(list instanceof Array, true);
        assert.strictEqual(typeof count, 'number');
      });

      it('게시글에는 작성자가 포함되어 있어야 하며, 이름과 사진을 알아볼 수 있어야 한다.', async () => {
        list.forEach((article) => {
          assert.notStrictEqual(article.writer, undefined);
          assert.notStrictEqual(article.writer.id, undefined);
          assert.notStrictEqual(article.writer.profileImage, undefined);
          assert.notStrictEqual(article.writer.nickname, undefined);
        });
      });

      it('게시글 리스트에서도 일정 개수(length) 이상의 댓글 배열이 포함되어 있어야 한다.', async () => {
        const article = list.at(0);
        assert.notStrictEqual(article, undefined);
        if (article) {
          assert.strictEqual(article.comments instanceof Array, true);
        }
      });
    });

    describe('게시글 리스트 조회 시 작성자에 대한 정보 검증', () => {
      let writer: UserEntity;

      before(async () => {
        const writerMetadata = generateRandomNumber(1000, 9999, true);
        writer = await UserEntity.save({
          name: writerMetadata,
          nickname: writerMetadata,
          password: writerMetadata,
        });

        await ArticleEntity.save({ writerId: writer.id, contents: writerMetadata, type: 'question' });
      });

      it('본인이 게시글의 작성자인 경우에는 본인인 줄 알 수 있게 표기가 되어야 한다.', async () => {
        const response = await service.read(writer.id, { page: 1, limit: 10 }, {});
        const myArticle = response.list.find((el) => el.writer.id === writer.id);

        assert.notStrictEqual(myArticle, undefined);
        if (myArticle) {
          assert.strictEqual(myArticle['isMine'], true);
        }
      });
    });

    describe('게시글 내부의 댓글에 대한 검증', () => {
      let writer: UserEntity;
      let article: ArticleEntity;
      let comments: CommentEntity[];

      /**
       * response
       */
      let list: ArticleType.Element[];
      let count: number;

      before(async () => {
        const writerMetadata = generateRandomNumber(1000, 9999, true);
        writer = await UserEntity.save({
          name: writerMetadata,
          nickname: writerMetadata,
          password: writerMetadata,
        });

        article = await ArticleEntity.save({ writerId: writer.id, contents: writerMetadata, type: 'question' });
        comments = await CommentEntity.save(
          [1, 2, 3].map((el) => {
            return CommentEntity.create({
              articleId: article.id,
              writerId: writer.id,
              contents: `test${el}`,
            });
          }),
        );

        const response = await service.read(writer.id, { page: 1, limit: 100 }, {});
        list = response.list;
      });

      it('게시글의 글 순서는 기본적으로는 시간 순이다.', async () => {
        const [created]: ArticleType.Element[] = list.filter((el) => el['id'] === article.id);
        const sorted = created.comments.sort((a, b) => a.id - b.id);

        const isSame = JSON.stringify(created.comments) === JSON.stringify(sorted);

        assert.strictEqual(isSame, true);
      });

      it('게시글의 댓글 배열은 인기 순, 좋아요 순으로 정렬되어야 한다.', async () => {});
    });

    describe('시간 순이되, 보여지는 글은 유명인이거나 1촌 등 가까운 사이의 글만 노출된다.', () => {});

    describe('게시글의 작성자가 이탈한 경우 프로필 사진과 이름은 익명으로 표기되어야 한다.', () => {});
  });

  describe('POST api/v1/articles', () => {
    it('동일한 포지션의 이미지가 있을 경우 에러를 발생 1.', async () => {
      const positions = [1, 2, 3, 4, 5, 6, 6].map((position) => ({ position }));
      try {
        const checkIsSame = service['checkIsSamePosition'](positions);
        assert.strictEqual(checkIsSame, '이미지의 정렬 값이 동일한 경우가 존재합니다.');
      } catch (err: any) {
        //.strictEqual assert(err?.response?.data, '이미지의 정렬 값이 동일한 경우가 존재합니다.');
      }
    });

    it('postion 값이 0과 1일 경우 에러로 처리되는 문제 발생 2.', async () => {
      // NOTE : 프론트 측의 오류 제보로 인해 추가
      const positions = [0, 1].map((position) => ({ position }));
      try {
        const checkIsSame = service['checkIsSamePosition'](positions);
        assert.strictEqual(JSON.stringify(checkIsSame), JSON.stringify(positions));
      } catch (err) {
        assert.strictEqual(err, undefined);
      }
    });

    it('이미지의 정렬 값이 동일한 경우가 존재하면 안 된다.', async () => {
      const positions = [undefined, undefined, undefined].map((position) => ({ position }));
      const answer = [0, 1, 2].map((position) => ({ position }));

      const checkIsSame = service['checkIsSamePosition'](positions);
      assert.strictEqual(JSON.stringify(checkIsSame), JSON.stringify(answer));
    });
  });

  describe('GET api/v1/articles', () => {
    let writer: UserEntity;
    let article: ArticleEntity;
    let comments: CommentEntity[];

    before(async () => {
      const writerMetadata = generateRandomNumber(1000, 9999, true);
      writer = await UserEntity.save({
        name: writerMetadata,
        nickname: writerMetadata,
        password: writerMetadata,
      });

      article = await ArticleEntity.save({ writerId: writer.id, contents: writerMetadata, type: 'question' });
      comments = await CommentEntity.save(
        [1, 2, 3].map((el) => {
          return CommentEntity.create({
            articleId: article.id,
            writerId: writer.id,
            contents: `test${el}`,
          });
        }),
      );
    });

    it('게시글을 조회할 때, 게시글에 댓글이 있는 경우 댓글이 조회되어야 한다.', async () => {
      const detailArticle = await controller.getOneDetailArticle(writer.id, article.id);

      assert.notStrictEqual(detailArticle.data, undefined);
      if (detailArticle.code === 1000) {
        assert.strictEqual(detailArticle.data.comments instanceof Array, true);
        if (detailArticle.data.comments) {
          assert.strictEqual(detailArticle.data.comments.length > 0, true);
          assert.strictEqual(detailArticle.data.comments.length, 3);
          const comment = detailArticle.data.comments.at(0);
          assert.notStrictEqual(comment, undefined);

          if (comment) {
            assert.notStrictEqual(comment.id, undefined);
            assert.notStrictEqual(comment.parentId, undefined);
            assert.notStrictEqual(comment.contents, undefined);
            assert.notStrictEqual(comment.xPosition, undefined);
            assert.notStrictEqual(comment.yPosition, undefined);
          }
        }
      }
    });
  });

  describe('GET api/v1/articles/:id/comments', () => {
    let writer: UserEntity;
    let article: ArticleEntity;
    let comments: CommentEntity[];

    before(async () => {
      const writerMetadata = generateRandomNumber(1000, 9999, true);
      writer = await UserEntity.save({
        name: writerMetadata,
        nickname: writerMetadata,
        password: writerMetadata,
      });

      article = await ArticleEntity.save({ writerId: writer.id, contents: writerMetadata, type: 'question' });
      comments = await CommentEntity.save(
        [1, 2, 3].map((el) => {
          return CommentEntity.create({
            articleId: article.id,
            writerId: writer.id,
            contents: `test${el}`,
          });
        }),
      );
    });

    it('특정 게시글의 댓글을 조회하는, 페이지네이션 함수가 제공된다.', async () => {
      const comment1 = await controller.readComments(article.id, { page: 1, limit: 1 });
      const comment2 = await controller.readComments(article.id, { page: 2, limit: 1 });
      const comment3 = await controller.readComments(article.id, { page: 3, limit: 1 });

      [comment1.data?.list.at(0), comment2.data?.list.at(0), comment3.data?.list.at(0)].forEach((comment, i) => {
        assert.notStrictEqual(comment, undefined);
        if (comment) {
          const searchedComment = comments.at(i);
          if (searchedComment) {
            assert.strictEqual(comment.id, searchedComment.id);
          }
        }
      });
    });
  });
});
