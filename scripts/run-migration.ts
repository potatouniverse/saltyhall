/**
 * Script to run database migrations
 * Usage: npx tsx scripts/run-migration.ts migrations/010_tool_market.sql
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function runMigration(migrationFile: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), migrationFile);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, "utf8");
  console.log(`Running migration: ${migrationFile}`);
  console.log(`SQL length: ${sql.length} characters`);

  try {
    // Execute the SQL
    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
    
    if (error) {
      // If the RPC function doesn't exist, try a different approach
      console.log("RPC method failed, trying direct execution...");
      
      // Split by semicolons and execute each statement
      const statements = sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));

      for (const statement of statements) {
        console.log(`Executing: ${statement.substring(0, 100)}...`);
        const result = await supabase.from("_migrations").select("*").limit(0);
        // Note: Direct SQL execution isn't supported via JS client
        // User must run this via Supabase dashboard SQL editor
      }
      
      throw new Error(
        "Cannot execute SQL directly via JS client. Please run the migration via Supabase Dashboard > SQL Editor"
      );
    }

    console.log("✅ Migration completed successfully!");
    console.log("Data:", data);
  } catch (error: any) {
    console.error("❌ Migration failed:");
    console.error(error.message || error);
    console.log("\n📝 Manual steps:");
    console.log("1. Go to: https://supabase.com/dashboard/project/gbrblkhrftuzaohqaymu/sql");
    console.log(`2. Paste the contents of: ${migrationFile}`);
    console.log("3. Click 'Run'\n");
    process.exit(1);
  }
}

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Usage: npx tsx scripts/run-migration.ts <migration-file>");
  process.exit(1);
}

runMigration(migrationFile);
