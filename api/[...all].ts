import { createApp } from "../src/server/app";

const app = createApp();

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

export default app;
