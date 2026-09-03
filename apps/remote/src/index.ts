import { createPublishApp, type PublishStore, type PublishedRecord } from "../../../packages/http/src/publish.ts";

export type Env = {
  ARTIFACTS: R2Bucket;
  PUBLISH_TOKEN: string;
  PUBLIC_ORIGIN: string;
};

function r2Store(bucket: R2Bucket): PublishStore {
  return {
    async put(record: PublishedRecord) {
      await bucket.put(`meta/${record.id}`, JSON.stringify(record));
    },
    async get(id: string) {
      const obj = await bucket.get(`meta/${id}`);
      if (!obj) return null;
      return JSON.parse(await obj.text()) as PublishedRecord;
    },
    async delete(id: string) {
      await bucket.delete(`meta/${id}`);
    },
  };
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const app = createPublishApp({
      store: r2Store(env.ARTIFACTS),
      token: env.PUBLISH_TOKEN,
      origin: env.PUBLIC_ORIGIN || "https://a.htmlark.com",
    });
    return app.fetch(request);
  },
};
