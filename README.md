# nestia-example

```bash
npm run start:local
```

```text
# .env
DB_TYPE=
LOCAL_DB_HOST=
LOCAL_DB_PORT=
LOCAL_DB_USERNAME=
LOCAL_DB_DATABASE=
LOCAL_DB_PASSWORD=

TEST_DB_HOST=
TEST_DB_PORT=
TEST_DB_USERNAME=
TEST_DB_DATABASE=
TEST_DB_PASSWORD=
```

## Testing on Nestia

```bash
npm run test:watch
```

## Swagger

```bash
npm run build
   # npm run prebuild  : rimraf dist
   # npm run build     : nest build
   # npm run postbuild : npx nestia swagger && npx nestia sdk
```


## SDK

```bash
npm run build
   # npm run prebuild  : rimraf dist
   # npm run build     : nest build
   # npm run postbuild : npx nestia swagger && npx nestia sdk

npm run publish # cd packages/api/lib && npm publish
```


1. npx nestia sdk
2. packages/api/lib/package.json

## SDK



```typescript
import * as Apis from 'picktogram-server-apis/api/functional';

try {
  const connection = {
    host: SERVER_URL,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
  };

  // /api/v1/articles/reports 경로의 report()

  const response = await Apis.api.v1.articles.reports.report(connection, articleId, {
    reason: '불쾌한 언행으로 인한 신고',
  });
  return response.data;
} catch (err) {
  throw err;
}
```
