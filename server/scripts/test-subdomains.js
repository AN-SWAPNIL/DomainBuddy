// Simple test script to verify subdomain API endpoints
const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Test configuration
const testConfig = {
  // You'll need to replace these with actual values after creating a user and domain
  authToken: 'YOUR_JWT_TOKEN_HERE', // Get this by logging in
  domainId: 'YOUR_DOMAIN_ID_HERE',  // Get this from your domains
  testSubdomain: {
    subdomain_name: 'test-api',
    record_type: 'A',
    target_value: '192.168.1.100',
    ttl: 3600
  }
};

async function testSubdomainAPI() {
  console.log('🧪 Testing Subdomain API Endpoints...\n');

  const headers = {
    'Authorization': `Bearer ${testConfig.authToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Test GET /api/domains/:domainId/subdomains
    console.log('1️⃣ Testing GET subdomains...');
    const getResponse = await axios.get(
      `${BASE_URL}/domains/${testConfig.domainId}/subdomains`,
      { headers }
    );
    console.log('✅ GET subdomains successful');
    console.log(`   Found ${getResponse.data.data.subdomains.length} subdomains\n`);

    // 2. Test POST /api/domains/:domainId/subdomains
    console.log('2️⃣ Testing POST create subdomain...');
    const createResponse = await axios.post(
      `${BASE_URL}/domains/${testConfig.domainId}/subdomains`,
      testConfig.testSubdomain,
      { headers }
    );
    console.log('✅ POST create subdomain successful');
    const newSubdomainId = createResponse.data.data.subdomain.id;
    console.log(`   Created subdomain with ID: ${newSubdomainId}\n`);

    // 3. Test GET specific subdomain
    console.log('3️⃣ Testing GET specific subdomain...');
    const getOneResponse = await axios.get(
      `${BASE_URL}/domains/${testConfig.domainId}/subdomains/${newSubdomainId}`,
      { headers }
    );
    console.log('✅ GET specific subdomain successful');
    console.log(`   Subdomain: ${getOneResponse.data.data.subdomain.subdomain_name}\n`);

    // 4. Test PUT update subdomain
    console.log('4️⃣ Testing PUT update subdomain...');
    const updateData = {
      target_value: '192.168.1.200',
      ttl: 7200
    };
    const updateResponse = await axios.put(
      `${BASE_URL}/domains/${testConfig.domainId}/subdomains/${newSubdomainId}`,
      updateData,
      { headers }
    );
    console.log('✅ PUT update subdomain successful');
    console.log(`   Updated target to: ${updateResponse.data.data.subdomain.target_value}\n`);

    // 5. Test DELETE subdomain
    console.log('5️⃣ Testing DELETE subdomain...');
    const deleteResponse = await axios.delete(
      `${BASE_URL}/domains/${testConfig.domainId}/subdomains/${newSubdomainId}`,
      { headers }
    );
    console.log('✅ DELETE subdomain successful');
    console.log(`   Message: ${deleteResponse.data.data.message}\n`);

    console.log('🎉 All subdomain API tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Tip: Update the authToken in testConfig with a valid JWT token');
    }
    if (error.response?.status === 404) {
      console.log('💡 Tip: Update the domainId in testConfig with a valid domain ID');
    }
  }
}

// Validation tests
function testValidationHelpers() {
  console.log('\n🔍 Testing validation helpers...\n');

  // Import the validation functions
  const subdomainService = require('../src/services/subdomainService');

  // Test subdomain name validation
  console.log('Testing subdomain name validation:');
  const testNames = ['www', 'api', 'test-123', '-invalid', 'valid-name', 'toolong' + 'a'.repeat(60)];
  testNames.forEach(name => {
    const isValid = subdomainService.validateSubdomainName(name);
    console.log(`  "${name}": ${isValid ? '✅' : '❌'}`);
  });

  // Test target value validation
  console.log('\nTesting target value validation:');
  const testTargets = [
    { type: 'A', value: '192.168.1.1', expected: true },
    { type: 'A', value: '999.999.999.999', expected: false },
    { type: 'CNAME', value: 'example.com', expected: true },
    { type: 'CNAME', value: 'invalid', expected: false },
    { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', expected: true }
  ];

  testTargets.forEach(test => {
    const result = subdomainService.validateTargetValue(test.type, test.value);
    const passed = result.valid === test.expected;
    console.log(`  ${test.type} "${test.value}": ${passed ? '✅' : '❌'} (${result.message})`);
  });

  console.log('\n✅ Validation tests completed');
}

// Instructions for manual testing
function printManualTestInstructions() {
  console.log(`
🔧 Manual Testing Instructions:

1. Make sure both server and client are running:
   - Server: http://localhost:5001
   - Client: http://localhost:5173

2. Complete these steps in the browser:
   a) Register/login to get a JWT token
   b) Purchase or add a domain
   c) Navigate to domain details page
   d) Test the subdomain management interface

3. To run the automated API tests:
   a) Get your JWT token from browser dev tools (localStorage)
   b) Get a domain ID from the my-domains page
   c) Update the testConfig in this file
   d) Run: node scripts/test-subdomains.js

4. Test scenarios to verify:
   - Create subdomains with different record types (A, CNAME, MX, TXT)
   - Edit existing subdomains
   - Delete subdomains
   - Validation error handling
   - Domain ownership verification

5. Check the database:
   - Verify records are created in the subdomains table
   - Check that soft deletes work (is_active = false)
   - Verify foreign key constraints

🐛 Common Issues:
   - 401 Unauthorized: Token expired or invalid
   - 404 Not Found: Domain doesn't exist or no access
   - 409 Conflict: Subdomain name already exists
   - 400 Bad Request: Validation errors

📚 API Documentation: See SUBDOMAIN_IMPLEMENTATION.md
  `);
}

// Run tests based on command line argument
const arg = process.argv[2];

if (arg === 'api' && testConfig.authToken !== 'YOUR_JWT_TOKEN_HERE') {
  testSubdomainAPI();
} else if (arg === 'validation') {
  testValidationHelpers();
} else {
  printManualTestInstructions();
}

module.exports = {
  testSubdomainAPI,
  testValidationHelpers
};
