import { drizzle } from "drizzle-orm/neon-http";
import { relations } from "./schema";

const db = drizzle(process.env.DATABASE_URL!, { relations });

export { db };
