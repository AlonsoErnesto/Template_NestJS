import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { INestApplication } from '@nestjs/common';
import * as ArticleApis from '../../api/functional/api/v1/articles';
import * as AuthApis from '../../api/functional/api/v1/auth';
import typia from 'typia';
import { CreateUserDto } from '../../models/dtos/create-user.dto';
import { CreateArticleDto } from '../../models/dtos/create-article.dto';
import { CreateCommentDto } from '../../models/dtos/create-comment.dto';
import { CommentEntity } from '../../models/tables/comment.entity';
import { DecodedUserToken } from '../../models/tables/user.entity';
import { ArticleType, CommentType, Try, TryPagination } from '../../types';
import { isBusinessErrorGuard } from '../../config/errors';
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { IConnection } from '@nestia/fetcher';

describe('E2E articles test', () => {
  const host = 'http://localhost:4000';
  let app: INestApplication;
  let testingModule: TestingModule;

  before(async () => {
    testingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = testingModule.createNestApplication();
    await (await app.init()).listen(4000);
  });

  after(async () => {
    await app.close();
  });

  describe('POST api/v1/articles', { concurrency: false }, () => {
    let token: string = '';
    before(async () => {
      const designer = typia.random<CreateUserDto>();
      await AuthApis.sign_up.signUp({ host }, designer);
      const response = await AuthApis.login({ host }, designer);
      token = response.data;
    });

    it('이미지 없이 게시글이 생성되는 것을 확인한다.', async () => {
      const articleToSave = typia.random<CreateArticleDto>();
      const writeArticleResponse = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { contents: articleToSave.contents, type: 'writing' },
      );

      assert.notStrictEqual(writeArticleResponse.data, undefined);
    });

    it('이미지가 있는 경우에는 이미지의 경로가 모두 달라야 한다.', { todo: true });
    it('이미지가 있을 때, 이미지의 포지션이 동일해서는 안 된다.', { todo: true });
  });

  describe('GET api/v1/articles', { concurrency: false }, () => {
    let connection: IConnection;
    let article: ArticleType.DetailArticle;

    before(async () => {
      const designer = typia.random<CreateUserDto>();
      await AuthApis.sign_up.signUp({ host }, designer);
      const response = await AuthApis.login({ host }, designer);

      connection = {
        host,
        headers: {
          Authorization: response.data,
        },
      };

      /**
       * 테스트를 위해 자기 자신의 이름으로 게시글 하나를 생성
       */
      const createArticleDto = typia.random<CreateArticleDto>();
      createArticleDto.images = [{ url: 'test.jpg' }];
      const writeArticleResponse = (await ArticleApis.writeArticle(
        connection,
        createArticleDto,
      )) as unknown as Try<ArticleType.DetailArticle>;
      article = writeArticleResponse.data;
    });

    it('게시글 조회 테스트', async () => {
      const response = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });

      assert.strictEqual(response.data.list instanceof Array, true);
    });

    it('게시글 리스토 조회 시 나와의 관계를 의미하는 프로퍼티가 필요.', async () => {
      const response = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });

      assert.notStrictEqual(response.data.list.length, 0);
      response.data.list.forEach((article) => {
        assert.notStrictEqual(article.writer.followStatus, undefined);
      });
    });

    it('썸네일 이미지가 조회되어야 한다.', async () => {
      const response = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });

      assert.notStrictEqual(response.data.list.length, 0);
      response.data.list.forEach((article) => {
        assert.notStrictEqual(article.thumbnail, undefined);
      });
    });

    it('게시글 조회 시 검색이 가능해야 한다.', async () => {
      /**
       * 검색 테스트할 대상을 생성하기
       */
      const createArticleDto = typia.random<CreateArticleDto>();
      const first = await ArticleApis.writeArticle(connection, { ...createArticleDto, contents: 'abcd' });
      const second = await ArticleApis.writeArticle(connection, { ...createArticleDto, contents: '가나다' });

      if (isBusinessErrorGuard(first) || isBusinessErrorGuard(second)) {
        assert.deepStrictEqual(1, 2);
        return;
      }

      const getResponse = await ArticleApis.getAllArticles(connection, { page: 1, limit: 100, searchKeyword: 'abcd' });
      /**
       * 검색 시 조회되어야 한다.
       */
      const firstIsSearched = getResponse.data.list.find((el) => el.id === first.data.id);
      assert.notDeepStrictEqual(firstIsSearched, undefined);

      /**
       * 검색 시 조회되선 안 된다. ( 검색어에 포함되지 않아 있는 글의 경우 )
       */
      const secondIsSearched = getResponse.data.list.find((el) => el.id === second.data.id);
      assert.deepStrictEqual(secondIsSearched, undefined);
    });

    it('게시글 조회 시 내가 좋아요한 글인지 여부가 나와야 한다. ( false )', { concurrency: true }, async () => {
      const response = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });

      assert.notStrictEqual(response.data.list.length, 0);
      response.data.list.forEach((article) => {
        assert.notStrictEqual(article.myPick, undefined);
        assert.deepStrictEqual(article.myPick, false);
      });
    });

    it('게시글 좋아요 이후에 좋아할 경우에 대한 검증', async () => {
      const firstGetAllResponse = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });
      assert.notStrictEqual(firstGetAllResponse.data.list.length, 0);

      /**
       * 한 게시글을 꺼내 좋아요를 누른다.
       */
      const firstArticle = firstGetAllResponse.data.list.at(0);
      await ArticleApis.likeOrUnlike(connection, firstArticle?.id as number);

      const secondGetAllResponse = await ArticleApis.getAllArticles(connection, { page: 1, limit: 10 });
      assert.notStrictEqual(secondGetAllResponse.data.list.length, 0);

      const myPick = secondGetAllResponse.data.list.find((el) => el.id === firstArticle?.id)?.myPick;
      assert.deepStrictEqual(myPick, true);
    });

    it('각 게시글 타입 별 프로퍼티에 대한 검증 필요', { todo: true });
  });

  /**
   * 답변을 기다리는 질문
   */
  describe('GET api/v1/articles/no-reply', { concurrency: false }, () => {
    let token: string = '';
    let decodedToken: DecodedUserToken;
    beforeEach(async () => {
      const designer = typia.random<CreateUserDto>();
      const signUpResponse = await AuthApis.sign_up.signUp({ host }, designer);
      if (isBusinessErrorGuard(signUpResponse)) {
        assert.strictEqual(1, 2);
        return;
      }

      decodedToken = signUpResponse.data;

      const response = await AuthApis.login({ host }, designer);
      token = response.data;
    });

    it('질문 게시글 조회', async () => {
      const getAllWithNoReplyResponse = await ArticleApis.no_reply.getAllWithNoReply(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { page: 1, limit: 10 },
      );

      assert.strictEqual(getAllWithNoReplyResponse.data.list instanceof Array, true);
    });

    it('질문이 아닌 글은 작성해도 조회되지 말아야 한다.', async () => {
      const dummyWriting = typia.random<CreateArticleDto>();
      dummyWriting.type = 'writing';
      const writing = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { contents: dummyWriting.contents, type: dummyWriting.type },
      );

      const getAllWithNoReplyResponse = await ArticleApis.no_reply.getAllWithNoReply(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { page: 1, limit: 10 },
      );

      const isAlreadyCreatedArticle = getAllWithNoReplyResponse.data.list.some((el) => {
        if (typeof writing.data === 'string') {
          return false;
        }
        return el.id === writing.data.id;
      });

      assert.strictEqual(isAlreadyCreatedArticle, false);
    });

    it('"댓글이 없는 질문 타입의 게시글"만 나오는지에 대한 검증', async () => {
      // NOTE : 질문이면서 댓글이 없는 경우는 조회되어야 한다.
      const dummyQuestion = typia.random<CreateArticleDto>();
      dummyQuestion.type = 'question';
      const questionWithNoReply = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { contents: dummyQuestion.contents, type: dummyQuestion.type },
      );

      const getAllWithNoReplyResponse = await ArticleApis.no_reply.getAllWithNoReply(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { page: 1, limit: 10 },
      );

      assert.strictEqual(getAllWithNoReplyResponse.data.list instanceof Array, true);
      assert.strictEqual(
        getAllWithNoReplyResponse.data.list.some((el) => {
          return typeof questionWithNoReply.data !== 'string' && el.id === questionWithNoReply.data.id;
        }),
        true,
      );
    });

    it('질문형 게시글이지만 댓글이 있는 경우에는 조회되지 말아야 한다.', async () => {
      // NOTE : 질문이지만 댓글이 달린 경우는 조회되서는 안 된다.
      const dummyQuestionWithReply = typia.random<CreateArticleDto>();
      const dummyReply = typia.random<CreateCommentDto>();
      delete dummyReply.imageId;

      dummyQuestionWithReply.type = 'question';
      const questionWithReply = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { contents: dummyQuestionWithReply.contents, type: dummyQuestionWithReply.type },
      );

      if (questionWithReply.code !== 1000) {
        assert.strictEqual(1, 2);
        return;
      }

      await CommentEntity.save({
        contents: dummyReply.contents,
        articleId: questionWithReply.data.id,
        writerId: decodedToken.id,
      });

      const getAllWithNoReplyResponse = await ArticleApis.no_reply.getAllWithNoReply(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        { page: 1, limit: 10 },
      );

      assert.strictEqual(getAllWithNoReplyResponse.data.list instanceof Array, true);
      assert.strictEqual(
        getAllWithNoReplyResponse.data.list.some((el) => el.id === questionWithReply.data.id),
        false,
      );
    });
  });

  /**
   * 게시글에 대한 좋아요/좋아요 취소
   */
  describe('PATCH api/v1/articles/:id', { concurrency: false }, () => {
    let token: string = '';
    let decodedToken: DecodedUserToken;
    beforeEach(async () => {
      const designer = typia.random<CreateUserDto>();
      const signUpResponse = await AuthApis.sign_up.signUp({ host }, designer);
      if (isBusinessErrorGuard(signUpResponse)) {
        assert.strictEqual(1, 2);
        return;
      }

      decodedToken = signUpResponse.data;

      const response = await AuthApis.login({ host }, designer);
      token = response.data;
    });

    /**
     * 만약 유저가 빠르게 눌러서 좋아요가 2번 눌릴 경우,
     * 좋아요 취소 대신 에러를 뱉는 게 옳다면 좋아요/좋아요 취소 API는 분리한다.
     */
    it('게시글에 좋아요/좋아요 취소가 가능하다.', async () => {
      // NOTE : 테스트 대상인 게시글을 생성
      const writeArticleResponse = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        typia.random<CreateArticleDto>(),
      );

      if (writeArticleResponse.code !== 1000) {
        assert.strictEqual(1, 2);
        return;
      }

      // NOTE : 좋아요 테스트
      const likeResponse = await ArticleApis.likeOrUnlike(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        writeArticleResponse.data.id,
      );

      // NOTE : 좋아요 취소 테스트
      const unlikeResponse = await ArticleApis.likeOrUnlike(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        writeArticleResponse.data.id,
      );

      assert.strictEqual(likeResponse.data, true); // NOTE : 실행 후 결과가 좋아요인 경우 true를 반환한다.
      assert.strictEqual(unlikeResponse.data, false); // NOTE : 실행 후 결과가 좋아요가 취소된 경우 false를 반환한다.
    });

    it('사라진 글에 대해서 좋아요는 불가능해야 한다.', async () => {
      const NON_ARTICLE = 987654321;
      const response = await ArticleApis.likeOrUnlike(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        NON_ARTICLE,
      );

      assert.strictEqual(response.data, '게시글을 찾지 못했습니다.');
    });

    /**
     * 추후 마이페이지나 그 외 페이지에서 좋아요를 모아보게 될 경우, 사라진 글들은 디자이너가 확인 후 취소가 가능해야 하기 때문
     */
    it('사라진 글에 대해서 좋아요 취소는 가능해야 한다.', { todo: true });
  });

  /**
   * 게시글 신고
   */
  describe('POST api/v1/articles/:id/reports', { concurrency: false }, () => {
    /**
     * article.isReported는 1이 올라가며, ReportArcticle table에 row 1개 생성
     */
    it('게시글을 신고한다.', { todo: true });
    it('신고 사유가 명시되어야 한다.', { todo: true });
    it('동일 유저는 하나의 게시글을 2회 이상 신고할 수 없다.', { todo: true });
    it('나 자신을 신고할 때는 안 된다고 안내 메시지를 준다.', { todo: true });

    /**
     * 아래의 TODO는 신고 철회 API에서 검증할 것
     */
    // it('동일 유저가 게시글을 신고 후 취소한 경우 isReported는 감소, ReportArticle table는 상태 변경', {todo: true});

    /**
     * isReported는 다시 증가, 그리고 ReportArticle table의 row는 상태 변경
     */
    it('신고가 철회된 게시글에 대해서 다시 신고하는 것이 가능해야 한다.', { todo: true });
  });

  /**
   * 게시글 중 그리기에 해당하는 글에 대한 수정
   */
  describe('PUT api/v1/articles/:id', { concurrency: false }, () => {
    /**
     * 이미지를 수정하는 경우, 해당 이미지를 저장하고 그 이력을 남겨야 한다.
     * 서비스 내 이미지는 개발자의 커밋 이력처럼, 이미지 이력이 남아야 한다.
     * 언젠가 이미지는 블록체인을 이용해서 저장
     */
    it('그리기(drawing) 타입의 게시글 수정 시, 만약 이미지를 수정하는 경우', { todo: true });

    /**
     * 그 외 수정 사항에 대해서는 다른 게시글 타입과 마찬가지로 동작해야 한다.
     */
    it('그리기(drawing) 타입의 게시글 수정 시, 이미지를 제외한 나머지를 수정하는 경우', { todo: true });

    it('그 외 나머지 타입에 대한 게시글 수정이 올바르게 되는지에 대한 검증', { todo: true });
  });

  /**
   * 게시글에 댓글 남기기
   * 그리기 타입 글에 대해서는 댓글에 좌표 값이 반드시 있어야 한다.
   */
  describe('POST api/v1/articles/:id/comments', { concurrency: false }, () => {
    let token: string = '';
    let decodedToken: DecodedUserToken;
    let article: ArticleType.DetailArticle;
    let connection: IConnection;
    beforeEach(async () => {
      const designer = typia.random<CreateUserDto>();
      const signUpResponse = await AuthApis.sign_up.signUp({ host }, designer);
      if (isBusinessErrorGuard(signUpResponse)) {
        assert.strictEqual(1, 2);
        return;
      }

      decodedToken = signUpResponse.data;

      const response = await AuthApis.login({ host }, designer);
      token = response.data;

      connection = {
        host,
        headers: {
          authorization: token,
        },
      };

      // NOTE : 테스트 대상인 게시글을 생성
      const createArticleDto = typia.random<CreateArticleDto>();
      createArticleDto.images = [
        {
          url: 'test.jpg',
          position: 0,
        },
      ];
      const writeArticleResponse = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        createArticleDto,
      );

      if (writeArticleResponse.code === 1000) {
        article = writeArticleResponse.data;
      }
    });

    it('게시글에 댓글 남기기', async () => {
      const commentToSave = typia.random<CreateCommentDto>();
      delete commentToSave.imageId;
      commentToSave.parentId = null;
      const comment = await ArticleApis.comments.writeComment(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        article.id,
        commentToSave,
      );

      assert.notStrictEqual(comment, undefined);
    });

    it('게시글, 이미지에 댓글 남기기', async () => {
      const commentToSave = typia.random<CreateCommentDto>();
      commentToSave.imageId = article.images?.at(0)?.id;
      commentToSave.parentId = null;
      const comment = (await ArticleApis.comments.writeComment(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        article.id,
        commentToSave,
      )) as unknown as Try<CommentType.CreateResponse>;

      assert.notStrictEqual(comment, undefined);
      assert.deepStrictEqual(typeof comment.data.imageId === 'number', true);
    });

    it('댓글에 대한 답글 달기', async () => {
      const parentCommentToSave = typia.random<CreateCommentDto>();
      parentCommentToSave.imageId = article.images?.at(0)?.id;
      parentCommentToSave.parentId = null;
      const parent = (await ArticleApis.comments.writeComment(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        article.id,
        parentCommentToSave,
      )) as unknown as Try<CommentType.CreateResponse>;

      const childCommentToSave = typia.random<CreateCommentDto>();
      childCommentToSave.imageId = article.images?.at(0)?.id;
      childCommentToSave.parentId = parent.data.id;
      const child = (await ArticleApis.comments.writeComment(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        article.id,
        childCommentToSave,
      )) as unknown as Try<CommentType.CreateResponse>;

      assert.notStrictEqual(child, undefined);
      assert.deepStrictEqual(typeof child.data.imageId === 'number', true);
      assert.deepStrictEqual(child.data.parentId === parent.data.id, true);
    });
  });

  /**
   * 댓글 조회하기
   */
  describe('GET api/v1/articles/:articleId/comments', { concurrency: false }, () => {
    let token: string = '';
    let decodedToken: DecodedUserToken;
    let article: ArticleType.DetailArticle;
    let connection: IConnection;
    beforeEach(async () => {
      const designer = typia.random<CreateUserDto>();
      const signUpResponse = await AuthApis.sign_up.signUp({ host }, designer);
      if (isBusinessErrorGuard(signUpResponse)) {
        assert.strictEqual(1, 2);
        return;
      }

      decodedToken = signUpResponse.data;

      const response = await AuthApis.login({ host }, designer);
      token = response.data;

      connection = {
        host,
        headers: {
          authorization: token,
        },
      };

      // NOTE : 테스트 대상인 게시글을 생성
      const createArticleDto = typia.random<CreateArticleDto>();
      const writeArticleResponse = await ArticleApis.writeArticle(
        {
          host,
          headers: {
            Authorization: token,
          },
        },
        createArticleDto,
      );

      if (writeArticleResponse.code === 1000) {
        article = writeArticleResponse.data;
      }
    });

    it('게시글에 달린 댓글 조회에 성공한다.', async () => {
      const getResponse = await ArticleApis.comments.readComments(connection, article.id, { page: 1, limit: 1 });
      assert.deepStrictEqual(getResponse.data.list instanceof Array, true);
    });

    it('게시글에 댓글인 달린 경우 그 댓글이 조회되어야 한다.', async () => {
      const writeResponse = await ArticleApis.comments.writeComment(connection, article.id, {
        contents: typia.random<string>(),
        parentId: null,
        xPosition: typia.random<`${number}`>(),
        yPosition: typia.random<`${number}`>(),
      });

      if (isBusinessErrorGuard(writeResponse)) {
        assert.deepStrictEqual(1, 2);
        return;
      }

      const getResponse = await ArticleApis.comments.readComments(connection, article.id, { page: 1, limit: 1 });
      assert.deepStrictEqual(getResponse.data.list instanceof Array, true);
      assert.deepStrictEqual(writeResponse.data.contents, getResponse.data.list.at(0)?.contents);
    });
  });

  /**
   * 답글 달기
   */
  describe('POST api/v1/articles/:articleId/comments/:commentId', { concurrency: false }, () => {
    it('게시글의 댓글에 답변을 남기기', { todo: true });
  });
  /**
   * 단일 게시글 조회
   */
  describe('GET api/v1/articles/:articleId', () => {
    let connection: IConnection;
    let article: ArticleType.DetailArticle;

    before(async () => {
      const designer = typia.random<CreateUserDto>();
      await AuthApis.sign_up.signUp({ host }, designer);
      const response = await AuthApis.login({ host }, designer);

      connection = {
        host,
        headers: {
          Authorization: response.data,
        },
      };

      /**
       * 테스트를 위해 자기 자신의 이름으로 게시글 하나를 생성
       */
      const createArticleDto = typia.random<CreateArticleDto>();
      createArticleDto.images = [{ url: 'test.jpg' }];
      const writeArticleResponse = (await ArticleApis.writeArticle(
        connection,
        createArticleDto,
      )) as unknown as Try<ArticleType.DetailArticle>;
      article = writeArticleResponse.data;
    });

    /**
     * @author kakasoo
     * @date 230627
     */
    it('게시글 조회에 성공해야 한다.', async () => {
      const getOneDetailArticleResponse = (await ArticleApis.getOneDetailArticle(
        connection,
        article.id,
      )) as unknown as Try<ArticleType.DetailArticle>;

      assert.notEqual(getOneDetailArticleResponse.data, undefined);
      assert.notEqual(getOneDetailArticleResponse.data, null);
      assert.deepStrictEqual(getOneDetailArticleResponse.data.images?.length, 1);
      assert.deepStrictEqual(getOneDetailArticleResponse.data.images.at(0)?.url, 'test.jpg');
    });
  });

  /**
   * 댓글에 대한 좋아요/좋아요 취소
   */
  describe('PATCH api/v1/articles/:articleId/comments/:commentId', { concurrency: false }, () => {
    it('댓글에 좋아요 하기', { todo: true });
    it('이미 좋아요한 댓글에 대해 좋아요를 할 경우 취소가 된다.', { todo: true });

    it('삭제된 댓글에 대해서 좋아요를 할 수는 없다.', { todo: true });

    /**
     * 추후 마이페이지나 그 외 페이지에서 좋아요를 모아보게 될 경우, 사라진 글들은 디자이너가 확인 후 취소가 가능해야 하기 때문
     */
    it('삭제된 댓글에 대해서는 좋아요 취소가 가능해야 한다.', { todo: true });
  });

  /**
   * 댓글 삭제
   */
  describe('DELETE api/v1/articles/:articleId/comments/:commentId', { concurrency: false }, () => {
    it('작성자는 댓글을 삭제할 수 있어야 한다.', { todo: true });
    it('본인의 댓글이 아닌 경우에는 에러를 뱉어야 한다.', { todo: true });

    /**
     * 추후 필요한 기능
     */
    it('신고 당한 댓글이 삭제될 경우, 관리자 채널로 알림을 보내야 한다.', { todo: true });
  });

  /**
   * 댓글 수정
   * 수정 시에는, 이전 내역이 욕설이나 그 외 상대의 기분을 해칠 수 있는 댓글인지를 확인해야 한다.
   */
  describe('PUT api/v1/articles/:articleId/comments/:commentId', { concurrency: false }, () => {
    it('댓글을 수정할 수 있다.', { todo: true });

    /**
     * 수정을 여러 차례에 나눠서 할 경우, 그 이력을 알 수 없기 때문에 모두 저장해야 한다.
     * 당장 급한 스펙은 아니다.
     */
    it('신고당한 글을 수정할 때에는 그 수정 이력을 저장해야 한다.', { todo: true });
  });

  /**
   * 댓글 신고
   * 댓글이 신고된 경우, 해당 댓글의 내역을, 유저가 수정할 경우를 대비해 따로 저장해두어야 한다.
   */
  describe('POST api/v1/articles/:articleid/comments/:commentId', { concurrency: false }, () => {
    /**
     * ReportComment에 칼럼을 두고, 신고 당시의 글 내용을 저장해두는 걸 추천한다.
     */
    it('댓글이 신고될 때, 신고 당시의 내용을 저장해야 한다.', { todo: true });
  });
});
