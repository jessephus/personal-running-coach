import { migrate } from "drizzle-orm/postgres-js/migrator";
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
  await migrateDatabase();
}
