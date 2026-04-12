import { migrate } from "drizzle-orm/postgres-js/migrator";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createDatabaseConnection } from "./client";

export async function migrateDatabase(connectionString?: string) {
  const connection = createDatabaseConnection({ connectionString });

  try {
    await migrate(connection.db, {
      migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
    });
  } finally {
    await connection.close();
  }
}

const entrypoint = process.argv[1];

if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  loadRepoEnvFile();
  await migrateDatabase();
}

function loadRepoEnvFile() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const envPath = resolve(repoRoot, ".env");

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
