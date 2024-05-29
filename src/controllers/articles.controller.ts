import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { UserId } from '../common/decorators/user-id.decorator';
import { CreateArticleDto } from '../models/dtos/create-article.dto';
import { CreateCommentDto } from '../models/dtos/create-comment.dto';
import { CommentsService } from '../providers/comments.service';
import { ArticlesService } from '../providers/articles.service';
import { ArticleType, CommentType, PaginationDto, TryCatch, TryPagination } from '../types';
import { createPaginationForm, createResponseForm } from '../common/interceptors/transform.interceptor';
import typia from 'typia';
import { isBusinessErrorGuard } from '../config/errors';
import {
  CANNOT_FINDONE_ARTICLE,
  ARLEADY_REPORTED_ARTICLE,
  CANNOT_FIND_ONE_COMMENT,
  CANNOT_FIND_ONE_REPLY_COMMENT,
  NOT_FOUND_ARTICLE_TO_COMMENT,
  TOO_MANY_REPORTED_ARTICLE,
  IS_NOT_WRITER_OF_THIS_ARTICLE,
  IS_SAME_POSITION,
  CANNOT_FIND_IMAGE_TO_LEFT_COMMENT,
} from '../config/errors/business-error';
import { TimeoutInterceptor } from '../common/interceptors/timeout.interceptor';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@UseInterceptors(LoggingInterceptor, TimeoutInterceptor)
@UseGuards(JwtGuard)
@Controller('api/v1/articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService, private readonly commentsService: CommentsService) {}

  /**
   * @summary 230312 - 댓글이 달리지 않는 게시글 리스트를 조회한다.
   * @tag articles
   * @param paginationDto 페이지 정보
   * @returns 답변이 없는 글들의 리스트
   */
  @TypedRoute.Get('no-reply')
  public async getAllWithNoReply(
    @UserId() userId: number,
    @TypedQuery() paginationDto: PaginationDto,
  ): Promise<TryPagination<ArticleType.GetAllArticlesReponse>> {
    const articlesToRead = await this.articlesService.read(userId, paginationDto, { isNoReply: true });
    const response = createPaginationForm(articlesToRead, paginationDto);
    return response;
  }

  /**
   * @summary 230312 - 게시글 신고하기
   * @tag articles
   * @param userId
   * @param articleId 신고할 대상인 게시글의 아이디
   * @returns 성공 시 true를 데이터로 반환
   */
  @TypedRoute.Post(':id/reports')
  public async report(
    @UserId() userId: number,
    @TypedParam('id', 'number') articleId: number,
    @TypedBody() reportReason: ArticleType.ReportReason,
  ): Promise<TryCatch<true, CANNOT_FINDONE_ARTICLE | ARLEADY_REPORTED_ARTICLE>> {
    const { reason } = reportReason;
    const articleToReport = await this.articlesService.getOneDetailArticle(userId, articleId);
    if (!articleToReport) {
      return typia.random<CANNOT_FINDONE_ARTICLE>();
    }
    const reportRespnose = await this.articlesService.report(userId, articleToReport.id, reason);
    if (reportRespnose !== true) {
      return reportRespnose;
    }

    return createResponseForm(true as const);
  }

  /**
   * @summary 230312 - 댓글 좋아요/좋아요 취소 기능
   * @tag articles
   * @param userId 좋아요/좋아요 취소를 할 사람
   * @param articleId 좋아요/좋아요 취소를 당하는 댓글의 게시글
   * @param commentId 좋아요/좋아요 취소를 당하는 댓글
   */
  @TypedRoute.Patch(':articleId/comments/:commentId')
  public async likeOrUnLikeComment(
    @UserId() userId: number,
    @TypedParam('articleId', 'number') articleId: number,
    @TypedParam('commentId', 'number') commentId: number,
  ): Promise<TryCatch<boolean, CANNOT_FIND_ONE_COMMENT>> {
    const comment = await this.commentsService.getOne(userId, articleId, commentId);
    if (isBusinessErrorGuard(comment)) {
      return comment;
    }
    const response = await this.commentsService.likeOrUnlike(userId, comment.id);
    return createResponseForm(response);
  }

  /**
   * @summary 230627 - 게시글의 댓글을 최신 순으로 조회한다.
   * @author kakasoo
   * @tag articles
   * @param articleId 댓글을 조회하고자 하는 게시글의 id
   * @param paginationDto 페이지 정보
   * @returns 댓글의 리스트
   */
  @TypedRoute.Get(':id/comments')
  public async readComments(
    @TypedParam('id', 'number') articleId: number,
    @TypedQuery() getCommentDto: CommentType.GetCommentDto,
  ): Promise<TryPagination<CommentType.CommentsByArcile>> {
    const comments = await this.commentsService.readByArticleId(articleId, getCommentDto);
    const response = createPaginationForm(comments, getCommentDto);
    return response;
  }

  /**
   * 게시글에 댓글을 작성한다.
   * 게시글에 댓글을 작성하는 API로, 본인의 게시글이든 아니든 상관 없이 동일한 기능을 수행한다.
   * @tag articles
   * @param writerId 작성자의 아이디
   * @param articleId 게시글의 아이디
   * @param createCommentDto 작성하고자 하는 댓글의 정보
   * @throw 4006 댓글을 작성할 게시글을 찾지 못했습니다.
   * @throw 4007 신고가 접수된 게시글이라 댓글 작성이 불가능합니다.
   * @returns 방금 작성된 댓글
   */
  @TypedRoute.Post(':id/comments')
  public async writeComment(
    @UserId() writerId: number,
    @TypedParam('id', 'number') articleId: number,
    @TypedBody() createCommentDto: CreateCommentDto,
  ): Promise<
    TryCatch<
      CommentType.CreateResponse,
      | CANNOT_FIND_ONE_REPLY_COMMENT
      | NOT_FOUND_ARTICLE_TO_COMMENT
      | TOO_MANY_REPORTED_ARTICLE
      | CANNOT_FIND_IMAGE_TO_LEFT_COMMENT
    >
  > {
    const comment = await this.commentsService.write(writerId, articleId, createCommentDto);
    if (isBusinessErrorGuard(comment)) {
      return comment;
    }
    return createResponseForm(comment);
  }

  /**
   * @summary 게시글에 대한 좋아요/좋아요 취소를 설정하는 기능 (리턴 형식에 주의)
   * @param userId 좋아요/좋아요 취소를 하는 사람
   * @param articleId 좋아요/좋아요 취소를 당한 게시글
   * @retruns 좋아요 성공 시 true, 실패 시 false 에는 에러 상황
   */
  @TypedRoute.Patch(':id')
  public async likeOrUnlike(
    @UserId() userId: number,
    @TypedParam('id', 'number') articleId: number,
  ): Promise<TryCatch<boolean, CANNOT_FINDONE_ARTICLE>> {
    const articleToPatch = await this.articlesService.getOneDetailArticle(userId, articleId);
    if (!articleToPatch) {
      return typia.random<CANNOT_FINDONE_ARTICLE>();
    }
    const response = await this.articlesService.likeOrUnLike(userId, articleToPatch.id);
    return createResponseForm(response);
  }

  /**
   * @summary 게시글 수정으로 작성자만이 가능하다 ( 각 게시글 타입에 맞게 기능 추가 필요 )
   * @tag articles
   * @param writerId 수정할 사람의 아이디로, 반드시 게시글 작성자의 아이디와 일치해야 한다.
   * @param articleId 수정할 게시글의 아이디
   * @param updateArticleDto 수정 후에 반영될 데이터
   */
  @TypedRoute.Put(':id')
  public async modify(
    @UserId() writerId: number,
    @TypedParam('id', 'number') articleId: number,
    @TypedBody() updateArticleDto: ArticleType.UpdateArticleDto,
  ): Promise<TryCatch<boolean, CANNOT_FINDONE_ARTICLE | IS_NOT_WRITER_OF_THIS_ARTICLE>> {
    const articleToUpdate = await this.articlesService.getOneDetailArticle(writerId, articleId);
    if (!articleToUpdate) {
      return typia.random<CANNOT_FINDONE_ARTICLE>();
    }

    if (writerId !== articleToUpdate.writer.id) {
      return typia.random<IS_NOT_WRITER_OF_THIS_ARTICLE>();
    }

    await this.articlesService.modify(articleId, updateArticleDto);
    return createResponseForm(true);
  }

  /**
   * @summary 게시글 상세 조회
   * @tag articles
   * @param userId 작성자의 아이디
   * @param articleId 조회하고자 하는 게시글의 id 값
   * @returns 조회한 게시글
   */
  @TypedRoute.Get(':id')
  public async getOneDetailArticle(
    @UserId() userId: number,
    @TypedParam('id', 'number') articleId: number,
  ): Promise<TryCatch<ArticleType.DetailArticle, CANNOT_FINDONE_ARTICLE>> {
    const article = await this.articlesService.getOneDetailArticle(userId, articleId);
    if (!article) {
      return typia.random<CANNOT_FINDONE_ARTICLE>();
    }
    return createResponseForm(article);
  }

  /**
   * @summary 게시글 리스트 조회
   * @tag articles
   * @param userId 조회를 하는 유저의 아이디
   * @param paginationDto 페이지의 정보
   * @returns 게시글 리스트
   */
  @TypedRoute.Get()
  public async getAllArticles(
    @UserId() userId: number,
    @TypedQuery() getAllArtcleDto: ArticleType.GetAllArtcleDto,
  ): Promise<TryPagination<ArticleType.GetAllArticlesReponse>> {
    const articlesToRead = await this.articlesService.read(userId, getAllArtcleDto, {});
    const response = createPaginationForm(articlesToRead, getAllArtcleDto);
    return response;
  }

  /**
   * @summary 230129 - 게시글 작성 / 임시저장 기능이 추가되어야 한다. (incompleted)
   * @tag articles
   
   * @param userId 글을 쓰고자 하는 작성자의 id
   * @param createArticleDto 게시글의 정보
   * @returns
   */
  @TypedRoute.Post()
  public async writeArticle(
    @UserId() userId: number,
    @TypedBody() createArticleDto: CreateArticleDto,
  ): Promise<TryCatch<ArticleType.DetailArticle, CANNOT_FINDONE_ARTICLE | IS_SAME_POSITION>> {
    const savedArticle = await this.articlesService.write(userId, createArticleDto);
    if (isBusinessErrorGuard(savedArticle)) {
      return savedArticle;
    }

    const article = await this.articlesService.getOneDetailArticle(userId, savedArticle.id);
    if (!article) {
      return typia.random<CANNOT_FINDONE_ARTICLE>();
    }
    return createResponseForm(article);
  }
}
