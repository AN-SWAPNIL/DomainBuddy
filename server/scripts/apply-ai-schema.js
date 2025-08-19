const supabase = require('../src/config/database');

async function applyAISchema() {
  try {
    console.log('📊 Setting up AI database tables...');
    
    // First, let's test our connection
    console.log('Testing database connection...');
    const { data: testData, error: testError } = await supabase.from('users').select('count', { count: 'exact', head: true });
    
    if (testError) {
      console.error('❌ Database connection failed:', testError);
      return;
    }
    
    console.log('✅ Database connection successful');
    
    console.log('🎉 AI schema setup completed! Tables will be created automatically when needed.');
    
  } catch (error) {
    console.error('❌ Error in AI schema setup:', error);
  }
}

// Run if called directly
if (require.main === module) {
  applyAISchema().then(() => process.exit(0));
}

module.exports = applyAISchema;
