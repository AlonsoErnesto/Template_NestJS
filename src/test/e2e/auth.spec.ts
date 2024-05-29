import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../app.module';
import { INestApplication } from '@nestjs/common';
import * as AuthApis from '../../api/functional/api/v1/auth';
import { CreateUserDto } from '../../models/dtos/create-user.dto';
import typia from 'typia';
import assert from 'assert';
import { after, before, describe, it } from 'node:test';

describe('E2E calendars test', () => {
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

  describe('POST api/auth/sign-up', () => {
    describe('로컬 회원가입 시 성별에 대한 검증', () => {
      it('만약 성별이 남성(true)인 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.gender = true;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });

      it('만약 성별이 여성(false)인 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.gender = false;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });

      it('만약 성별이 정의되어 있지 않은 (undefined) 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.gender = undefined;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });

      it('만약 성별이 없는 (null) 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.gender = null;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });
    });

    describe('로컬 회원가입 시 birth의 타입에 대한 검증', () => {
      it('만약 "YYYY-MM-DD" 형태의 문자열인 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.birth = `2023-02-05`;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });

      it('만약 null인 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.birth = null;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });

      it('만약 undefined인 경우', async () => {
        const designer = typia.random<CreateUserDto>();
        designer.birth = undefined;
        const response = await AuthApis.sign_up.signUp({ host }, designer);

        assert.notStrictEqual(response.data, undefined);
      });
    });

    it('회원 가입 시 자기 자신이 팔로우한 상태여야 한다.', { todo: true });
  });
});
