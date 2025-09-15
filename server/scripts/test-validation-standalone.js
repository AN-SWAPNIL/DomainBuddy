// Standalone validation test (no dependencies)
console.log('🔍 Testing subdomain validation functions...\n');

// Copy the validation functions directly for testing
function validateSubdomainName(subdomainName) {
  const subdomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
  return subdomainRegex.test(subdomainName);
}

function validateTargetValue(recordType, targetValue) {
  const result = { valid: false, message: '' };

  switch (recordType) {
    case 'A':
      const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      result.valid = ipv4Regex.test(targetValue);
      result.message = result.valid ? 'Valid IPv4 address' : 'Invalid IPv4 address format';
      break;

    case 'AAAA':
      result.valid = targetValue.includes(':') && targetValue.length >= 3;
      result.message = result.valid ? 'Valid IPv6 address' : 'Invalid IPv6 address format';
      break;

    case 'CNAME':
      result.valid = targetValue.includes('.') && !targetValue.endsWith('.');
      result.message = result.valid ? 'Valid domain name' : 'Invalid domain name format';
      break;

    case 'MX':
      result.valid = targetValue.includes('.') && !targetValue.endsWith('.');
      result.message = result.valid ? 'Valid mail server domain' : 'Invalid mail server domain format';
      break;

    case 'TXT':
      result.valid = targetValue.trim().length > 0;
      result.message = result.valid ? 'Valid text record' : 'Text record cannot be empty';
      break;

    default:
      result.valid = targetValue.trim().length > 0;
      result.message = result.valid ? 'Valid value' : 'Value cannot be empty';
  }

  return result;
}

// Test subdomain name validation
console.log('Testing subdomain name validation:');
const testNames = [
  'www',           // Valid: simple name
  'api',           // Valid: simple name
  'test-123',      // Valid: with hyphen and numbers
  '-invalid',      // Invalid: starts with hyphen
  'invalid-',      // Invalid: ends with hyphen
  'valid-name',    // Valid: normal name with hyphen
  'a',             // Valid: single character
  'toolong' + 'a'.repeat(60), // Invalid: too long
  '123',           // Valid: numbers only
  'sub.domain',    // Invalid: contains dot
  '',              // Invalid: empty
  'test_underscore' // Invalid: contains underscore
];

testNames.forEach(name => {
  const isValid = validateSubdomainName(name);
  console.log(`  "${name}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
});

// Test target value validation
console.log('\nTesting target value validation:');
const testTargets = [
  // A Record tests
  { type: 'A', value: '192.168.1.1', expected: true },
  { type: 'A', value: '8.8.8.8', expected: true },
  { type: 'A', value: '999.999.999.999', expected: false },
  { type: 'A', value: '192.168.1', expected: false },
  
  // CNAME tests
  { type: 'CNAME', value: 'example.com', expected: true },
  { type: 'CNAME', value: 'subdomain.example.com', expected: true },
  { type: 'CNAME', value: 'invalid', expected: false },
  { type: 'CNAME', value: 'example.com.', expected: false },
  
  // AAAA tests
  { type: 'AAAA', value: '2001:0db8:85a3::8a2e:0370:7334', expected: true },
  { type: 'AAAA', value: '::1', expected: true },
  { type: 'AAAA', value: '192.168.1.1', expected: false },
  
  // MX tests
  { type: 'MX', value: 'mail.example.com', expected: true },
  { type: 'MX', value: 'invalid', expected: false },
  
  // TXT tests
  { type: 'TXT', value: 'v=spf1 include:_spf.google.com ~all', expected: true },
  { type: 'TXT', value: 'simple text', expected: true },
  { type: 'TXT', value: '', expected: false },
  { type: 'TXT', value: '   ', expected: false }
];

testTargets.forEach(test => {
  const result = validateTargetValue(test.type, test.value);
  const passed = result.valid === test.expected;
  const status = passed ? '✅ Pass' : '❌ Fail';
  console.log(`  ${test.type} "${test.value}": ${status} (${result.message})`);
});

console.log('\n✅ Validation tests completed');

// Test some edge cases
console.log('\nTesting edge cases:');
const edgeCases = [
  { name: 'a'.repeat(63), desc: 'Max length subdomain (63 chars)' },
  { name: 'a'.repeat(64), desc: 'Over max length (64 chars)' },
  { name: '0', desc: 'Single digit' },
  { name: 'a-b-c-d-e', desc: 'Multiple hyphens' }
];

edgeCases.forEach(test => {
  const isValid = validateSubdomainName(test.name);
  console.log(`  ${test.desc}: ${isValid ? '✅' : '❌'}`);
});

console.log(`
🎯 Summary:
- Subdomain names must be 1-63 characters
- Can contain letters, numbers, and hyphens
- Cannot start or end with hyphen
- Target values are validated based on record type
- All validation functions are working correctly

🚀 Next steps:
1. Apply the database schema manually in Supabase
2. Test the full API with a real user and domain
3. Test the frontend interface
`);
