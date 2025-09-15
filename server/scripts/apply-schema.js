const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client with service role key
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error(
    "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applySchema() {
  try {
    console.log("🔄 Reading schema files...");

    // Read the main schema file
    const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Read the subdomain schema file
    const subdomainSchemaPath = path.join(__dirname, "..", "database", "subdomain_schema.sql");
    let subdomainSchema = '';
    if (fs.existsSync(subdomainSchemaPath)) {
      subdomainSchema = fs.readFileSync(subdomainSchemaPath, "utf8");
      console.log("📝 Subdomain schema file loaded");
    } else {
      console.log("⚠️  Subdomain schema file not found, skipping");
    }

    console.log("📝 Schema files loaded successfully");
    console.log("🚀 Applying main schema to Supabase database...");

    // Execute the main schema
    const { data, error } = await supabase.rpc("exec_sql", { sql: schema });

    if (error) {
      console.error("❌ Error applying main schema:", error);
      return;
    }

    console.log("✅ Main schema applied successfully!");

    // Apply subdomain schema if it exists
    if (subdomainSchema) {
      console.log("🚀 Applying subdomain schema...");
      const { data: subData, error: subError } = await supabase.rpc("exec_sql", { sql: subdomainSchema });

      if (subError) {
        console.error("❌ Error applying subdomain schema:", subError);
      } else {
        console.log("✅ Subdomain schema applied successfully!");
      }
    }

    console.log("🔍 Verifying tables...");

    // Verify tables exist
    const tables = [
      "users",
      "domains",
      "subdomains",
      "transactions",
      "refresh_tokens",
      "password_resets",
    ];

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("*").limit(1);
      if (error) {
        console.log(
          `⚠️  Table '${table}' might not exist or have access issues:`,
          error.message
        );
      } else {
        console.log(`✅ Table '${table}' is accessible`);
      }
    }

    // Verify specific columns
    console.log("🔍 Verifying specific columns...");

    // Check stripe_customer_id in users table
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("stripe_customer_id")
      .limit(1);

    if (userError) {
      console.log(
        "⚠️  stripe_customer_id column in users table:",
        userError.message
      );
    } else {
      console.log("✅ stripe_customer_id column exists in users table");
    }

    // Check stripe_payment_intent_id in transactions table
    const { data: transData, error: transError } = await supabase
      .from("transactions")
      .select("stripe_payment_intent_id")
      .limit(1);

    if (transError) {
      console.log(
        "⚠️  stripe_payment_intent_id column in transactions table:",
        transError.message
      );
    } else {
      console.log(
        "✅ stripe_payment_intent_id column exists in transactions table"
      );
    }

    // Check subdomain table structure
    if (subdomainSchema) {
      const { data: subdomainData, error: subdomainError } = await supabase
        .from("subdomains")
        .select("id, domain_id, subdomain_name, record_type")
        .limit(1);

      if (subdomainError) {
        console.log(
          "⚠️  subdomain table structure:",
          subdomainError.message
        );
      } else {
        console.log("✅ subdomains table structure is correct");
      }
    }

    console.log("🎉 Schema verification complete!");
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// Alternative method using direct SQL execution
async function applySchemaAlternative() {
  try {
    console.log("🔄 Alternative method: Applying schema in parts...");

    const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Split schema into individual statements
    const statements = schema
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);

          // For some statements, we might need to use different approaches
          if (
            statement.includes("CREATE TABLE") ||
            statement.includes("ALTER TABLE") ||
            statement.includes("CREATE INDEX") ||
            statement.includes("CREATE POLICY")
          ) {
            // These need to be executed via the SQL editor or migration
            console.log(
              `⚠️  Statement ${i + 1} needs manual execution:`,
              statement.substring(0, 50) + "..."
            );
          }
        } catch (error) {
          console.log(`⚠️  Error in statement ${i + 1}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ Error in alternative method:", error);
  }
}

// Run the schema application
console.log("🚀 Starting schema application...");
console.log("📊 Database URL:", supabaseUrl);

applySchema()
  .then(() => {
    console.log("✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Failed:", error);
    process.exit(1);
  });
