import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addMissingColumns() {
  try {
    console.log("🔄 Adding missing columns to transactions table...");

    // Add card_last4 column
    const { error: cardLast4Error } = await supabase.rpc("execute_sql", {
      sql: "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4);",
    });

    if (cardLast4Error && !cardLast4Error.message.includes("already exists")) {
      console.error("❌ Error adding card_last4 column:", cardLast4Error);
    } else {
      console.log("✅ Added card_last4 column");
    }

    // Add card_brand column
    const { error: cardBrandError } = await supabase.rpc("execute_sql", {
      sql: "ALTER TABLE transactions ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50);",
    });

    if (cardBrandError && !cardBrandError.message.includes("already exists")) {
      console.error("❌ Error adding card_brand column:", cardBrandError);
    } else {
      console.log("✅ Added card_brand column");
    }

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

addMissingColumns();
