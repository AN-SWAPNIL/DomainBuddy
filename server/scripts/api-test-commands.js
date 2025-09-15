// Quick API test commands
// Replace YOUR_JWT_TOKEN and YOUR_DOMAIN_ID with actual values

const testCommands = {
  // Get subdomains
  getSubdomains: `curl -X GET "http://localhost:5001/api/domains/YOUR_DOMAIN_ID/subdomains" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json"`,

  // Create subdomain
  createSubdomain: `curl -X POST "http://localhost:5001/api/domains/YOUR_DOMAIN_ID/subdomains" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "subdomain_name": "test",
    "record_type": "A",
    "target_value": "192.168.1.1",
    "ttl": 3600
  }'`,

  // Update subdomain
  updateSubdomain: `curl -X PUT "http://localhost:5001/api/domains/YOUR_DOMAIN_ID/subdomains/YOUR_SUBDOMAIN_ID" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "target_value": "192.168.1.200",
    "ttl": 7200
  }'`,

  // Delete subdomain
  deleteSubdomain: `curl -X DELETE "http://localhost:5001/api/domains/YOUR_DOMAIN_ID/subdomains/YOUR_SUBDOMAIN_ID" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN"`
};

console.log('📋 API Testing Commands:');
console.log('Replace YOUR_JWT_TOKEN and YOUR_DOMAIN_ID with actual values\n');

Object.entries(testCommands).forEach(([name, command]) => {
  console.log(`${name}:`);
  console.log(command);
  console.log('\n' + '='.repeat(80) + '\n');
});
