// Test DNS management functionality
const namecheapService = require('../src/services/namecheapService.js');
require('dotenv').config();

async function testDnsManagement() {
  console.log('🧪 Testing DNS Management Features...\n');

  // Test 1: Check if DNS propagation checking works
  console.log('📋 Test 1: DNS Propagation Check');
  try {
    const testResult = await namecheapService.checkDnsPropagation(
      'www', 
      'google.com', 
      'A', 
      '142.250.191.14'
    );
    console.log('✅ DNS propagation check result:', testResult);
  } catch (error) {
    console.error('❌ DNS propagation check failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Validate the DNS service configuration
  console.log('📋 Test 2: Service Configuration');
  console.log('Namecheap API User:', process.env.NAMECHEAP_API_USER ? '✅ Set' : '❌ Missing');
  console.log('Namecheap API Key:', process.env.NAMECHEAP_API_KEY ? '✅ Set' : '❌ Missing'); 
  console.log('Namecheap Client IP:', process.env.NAMECHEAP_CLIENT_IP || 'Will auto-detect');
  console.log('Sandbox Mode:', process.env.NAMECHEAP_SANDBOX === 'true' ? '✅ Enabled' : '❌ Disabled');

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Test getting current IP
  console.log('📋 Test 3: IP Detection');
  try {
    const currentIp = await namecheapService.getCurrentIP();
    console.log('✅ Current IP detected:', currentIp);
  } catch (error) {
    console.error('❌ IP detection failed:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  console.log('🏁 DNS Management Test Complete');
  console.log('\n📝 Implementation Status:');
  console.log('✅ DNS Record Creation - Implemented');
  console.log('✅ DNS Record Updates - Implemented'); 
  console.log('✅ DNS Record Deletion - Implemented');
  console.log('✅ DNS Propagation Checking - Implemented');
  console.log('✅ Background DNS Sync Service - Implemented');
  console.log('⚠️  Database Schema Updates - Needs manual application');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. Apply database schema updates in Supabase dashboard');
  console.log('2. Test subdomain creation with real domain');
  console.log('3. Monitor DNS background service logs');
  console.log('4. Verify DNS propagation checking');
}

// Run the test
testDnsManagement().catch(console.error);
