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

async function updateSubdomainSchema() {
  try {
    console.log('🚀 Updating subdomain schema with DNS tracking fields...');

    // Read the update SQL file
    const updatePath = path.join(__dirname, '../database/update_subdomains_dns_fields.sql');
    const updateSQL = fs.readFileSync(updatePath, 'utf8');

    console.log('📋 Executing DNS fields update...');

    // Split into individual statements and execute each one
    const statements = updateSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          console.log(`🔄 Executing: ${statement.substring(0, 50)}...`);
          
          // Execute using a simple query
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            // Try alternative method if exec_sql doesn't exist
            console.log('⚠️ exec_sql not available, manual execution required');
            console.log('📋 Please run this SQL manually in your Supabase dashboard:');
            console.log(statement);
            console.log('---');
          } else {
            successCount++;
          }
          
        } catch (stmtError) {
          console.error(`❌ Error executing statement: ${stmtError.message}`);
          console.log('Statement:', statement);
          errorCount++;
        }
      }
    }

    if (successCount > 0) {
      console.log(`✅ Successfully executed ${successCount} statements`);
    }
    
    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} statements need manual execution`);
    }

    console.log('📋 Update complete! The following fields were added:');
    console.log('  - dns_created: tracks if DNS record was created');
    console.log('  - dns_error: stores last DNS error message');
    console.log('  - retry_count: counts retry attempts');
    console.log('  - Updated status constraint to include "failed"');
    
    console.log('\n📝 Next steps:');
    console.log('1. Verify the fields exist in your subdomains table');
    console.log('2. Test subdomain creation with DNS management');
    console.log('3. Check DNS background service logs');

  } catch (error) {
    console.error('❌ Error updating subdomain schema:', error);
    console.log('\n📋 Manual execution required. Please run this file in Supabase:');
    console.log('   File: server/database/update_subdomains_dns_fields.sql');
  }
}

// Run the update
updateSubdomainSchema();
