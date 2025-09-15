const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySubdomainSchema() {
  try {
    console.log('🚀 Applying subdomain schema...');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../database/subdomains_table.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    // Execute the schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: schemaSQL
    });

    if (error) {
      // If the function doesn't exist, try direct execution
      console.log('🔄 Trying direct SQL execution...');
      
      // Split the SQL into individual statements
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            const { error: stmtError } = await supabase
              .from('_temp_schema_execution')
              .select('*')
              .limit(0);
            
            // If we can't execute directly, we'll need to use a different approach
            console.log(`⚠️ Direct execution not available. Please run the schema manually.`);
            console.log('📋 Schema file location:', schemaPath);
            break;
          } catch (directError) {
            console.log(`⚠️ Cannot execute schema directly. Please apply manually.`);
            break;
          }
        }
      }
    } else {
      console.log('✅ Subdomain schema applied successfully!');
    }

    console.log('📋 Next steps:');
    console.log('1. Verify the subdomains table exists in your database');
    console.log('2. Check that all constraints and indexes are created');
    console.log('3. Test the subdomain API endpoints');

  } catch (error) {
    console.error('❌ Error applying subdomain schema:', error);
    console.log('📋 Manual application required. Please run the SQL file:');
    console.log('   File: server/database/subdomains_table.sql');
  }
}

// Run the migration
applySubdomainSchema();
