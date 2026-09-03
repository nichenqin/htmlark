import { createPublishApp } from "../../../packages/http/src/publish.ts";
import { d1R2Store } from "./store.ts";

export type Env = {
  ARTIFACTS: R2Bucket;
  DB: D1Database;
  PUBLISH_TOKEN: string;
  PUBLIC_ORIGIN: string;
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const app = createPublishApp({
      store: d1R2Store(env.DB, env.ARTIFACTS),
      token: env.PUBLISH_TOKEN,
      origin: env.PUBLIC_ORIGIN || "https://a.htmlark.com",
    });
    return app.fetch(request);
  },
};
