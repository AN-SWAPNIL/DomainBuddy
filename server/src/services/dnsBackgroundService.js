const supabase = require("../config/database.js");
const namecheapService = require("./namecheapService.js");

class DnsBackgroundService {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.checkInterval = 5 * 60 * 1000; // 5 minutes
  }

  // Start the background DNS sync service
  start() {
    if (this.isRunning) {
      console.log("🔄 DNS background service is already running");
      return;
    }

    console.log("🚀 Starting DNS background service");
    this.isRunning = true;

    // Run initial check
    this.checkPendingDnsRecords();

    // Set up interval for regular checks
    this.interval = setInterval(() => {
      this.checkPendingDnsRecords();
    }, this.checkInterval);

    console.log(`✅ DNS background service started (checking every ${this.checkInterval / 1000} seconds)`);
  }

  // Stop the background DNS sync service
  stop() {
    if (!this.isRunning) {
      console.log("⏹️ DNS background service is not running");
      return;
    }

    console.log("⏹️ Stopping DNS background service");
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log("✅ DNS background service stopped");
  }

  // Check all pending DNS records and update their propagation status
  async checkPendingDnsRecords() {
    try {
      console.log("🔍 Checking pending DNS records...");

      // Get all subdomains that need DNS propagation checks
      const { data: pendingSubdomains, error } = await supabase
        .from("subdomains")
        .select(`
          id,
          subdomain_name,
          record_type,
          target_value,
          status,
          dns_propagated,
          last_checked,
          retry_count,
          domains!inner(full_domain)
        `)
        .eq("is_active", true)
        .in("status", ["pending", "active"])
        .eq("dns_propagated", false)
        .lt("retry_count", 5); // Don't retry more than 5 times

      if (error) {
        console.error("❌ Error fetching pending subdomains:", error);
        return;
      }

      if (!pendingSubdomains || pendingSubdomains.length === 0) {
        console.log("✅ No pending DNS records to check");
        return;
      }

      console.log(`📋 Found ${pendingSubdomains.length} DNS records to check`);

      // Process each subdomain
      for (const subdomain of pendingSubdomains) {
        await this.checkSubdomainPropagation(subdomain);
        
        // Add a small delay between checks to avoid overwhelming DNS servers
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log("✅ Completed DNS propagation check cycle");

    } catch (error) {
      console.error("❌ Error in DNS background check:", error);
    }
  }

  // Check DNS propagation for a specific subdomain
  async checkSubdomainPropagation(subdomain) {
    try {
      const domainName = subdomain.domains.full_domain;
      const fullDomain = `${subdomain.subdomain_name}.${domainName}`;

      console.log(`🔍 Checking DNS propagation for: ${fullDomain} (${subdomain.record_type})`);

      // Check DNS propagation
      const propagationResult = await namecheapService.checkDnsPropagation(
        subdomain.subdomain_name,
        domainName,
        subdomain.record_type,
        subdomain.target_value
      );

      const updateData = {
        last_checked: new Date().toISOString(),
        retry_count: (subdomain.retry_count || 0) + 1
      };

      if (propagationResult.success && propagationResult.propagated) {
        // DNS has propagated successfully
        console.log(`✅ DNS propagated for ${fullDomain}`);
        
        updateData.dns_propagated = true;
        updateData.status = 'active';
        updateData.dns_error = null;

      } else if (propagationResult.success && !propagationResult.propagated) {
        // DNS not propagated yet, but no error
        console.log(`⏳ DNS not yet propagated for ${fullDomain} (attempt ${updateData.retry_count})`);
        
        // If we've tried too many times, mark as failed
        if (updateData.retry_count >= 5) {
          console.log(`❌ DNS propagation failed after ${updateData.retry_count} attempts for ${fullDomain}`);
          updateData.status = 'failed';
          updateData.dns_error = `DNS propagation timeout after ${updateData.retry_count} attempts`;
        }

      } else {
        // Error occurred during check
        console.log(`❌ DNS propagation check failed for ${fullDomain}: ${propagationResult.message}`);
        
        updateData.dns_error = propagationResult.message;
        
        // If we've tried too many times, mark as failed
        if (updateData.retry_count >= 5) {
          updateData.status = 'failed';
        }
      }

      // Update the subdomain record
      const { error: updateError } = await supabase
        .from("subdomains")
        .update(updateData)
        .eq("id", subdomain.id);

      if (updateError) {
        console.error(`❌ Error updating subdomain ${fullDomain}:`, updateError);
      }

    } catch (error) {
      console.error(`❌ Error checking propagation for subdomain ${subdomain.id}:`, error);
      
      // Update retry count and error
      await supabase
        .from("subdomains")
        .update({
          last_checked: new Date().toISOString(),
          retry_count: (subdomain.retry_count || 0) + 1,
          dns_error: error.message
        })
        .eq("id", subdomain.id);
    }
  }

  // Manually trigger a check for all pending records
  async checkNow() {
    console.log("🔄 Manually triggering DNS propagation check...");
    await this.checkPendingDnsRecords();
  }

  // Retry failed DNS operations
  async retryFailedRecords() {
    try {
      console.log("🔄 Retrying failed DNS records...");

      // Get all failed subdomains
      const { data: failedSubdomains, error } = await supabase
        .from("subdomains")
        .select(`
          id,
          subdomain_name,
          record_type,
          target_value,
          ttl,
          domains!inner(full_domain)
        `)
        .eq("is_active", true)
        .eq("status", "failed")
        .lt("retry_count", 3); // Only retry up to 3 times

      if (error) {
        console.error("❌ Error fetching failed subdomains:", error);
        return;
      }

      if (!failedSubdomains || failedSubdomains.length === 0) {
        console.log("✅ No failed DNS records to retry");
        return;
      }

      console.log(`📋 Found ${failedSubdomains.length} failed DNS records to retry`);

      for (const subdomain of failedSubdomains) {
        await this.retryDnsCreation(subdomain);
        
        // Add delay between retries
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error("❌ Error retrying failed DNS records:", error);
    }
  }

  // Retry DNS creation for a specific subdomain
  async retryDnsCreation(subdomain) {
    try {
      const domainName = subdomain.domains.full_domain;
      const fullDomain = `${subdomain.subdomain_name}.${domainName}`;

      console.log(`🔄 Retrying DNS creation for: ${fullDomain}`);

      // Try to create the DNS record again
      const dnsResult = await namecheapService.createDnsRecord(
        domainName,
        subdomain.subdomain_name,
        subdomain.record_type,
        subdomain.target_value,
        subdomain.ttl
      );

      const updateData = {
        last_checked: new Date().toISOString(),
        retry_count: (subdomain.retry_count || 0) + 1
      };

      if (dnsResult.success) {
        console.log(`✅ DNS record creation successful for ${fullDomain}`);
        
        updateData.status = 'active';
        updateData.dns_created = true;
        updateData.dns_propagated = false; // Will be checked in next cycle
        updateData.dns_error = null;

      } else {
        console.log(`❌ DNS record creation failed for ${fullDomain}: ${dnsResult.message}`);
        
        updateData.dns_error = dnsResult.message;
        
        // If we've tried too many times, keep as failed
        if (updateData.retry_count >= 3) {
          updateData.status = 'failed';
        }
      }

      // Update the subdomain record
      const { error: updateError } = await supabase
        .from("subdomains")
        .update(updateData)
        .eq("id", subdomain.id);

      if (updateError) {
        console.error(`❌ Error updating subdomain ${fullDomain}:`, updateError);
      }

    } catch (error) {
      console.error(`❌ Error retrying DNS creation for subdomain ${subdomain.id}:`, error);
    }
  }

  // Get service status
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      lastCheck: new Date().toISOString()
    };
  }
}

// Create a singleton instance
const dnsBackgroundService = new DnsBackgroundService();

module.exports = dnsBackgroundService;
