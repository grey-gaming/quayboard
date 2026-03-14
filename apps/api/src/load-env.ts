import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const envFiles = [
  fileURLToPath(new URL("../../../.env", import.meta.url)),
  fileURLToPath(new URL("../.env", import.meta.url)),
];

let loaded = false;

export const loadEnv = () => {
  if (loaded) {
    return;
  }

  for (const envFile of envFiles) {
    if (existsSync(envFile)) {
      dotenv.config({ path: envFile });
      break;
    }
  }

  loaded = true;
};
