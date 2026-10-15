import { createApp } from "./app.js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env") });

const port = Number(process.env.API_PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`Labrary API listening on http://localhost:${port}`);
});
