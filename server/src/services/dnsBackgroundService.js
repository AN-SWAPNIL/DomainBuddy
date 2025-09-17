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
      
      // Clean up old expired records first
      await this.cleanupExpiredRecords();

      // Get all pending DNS propagation records that are due for checking
      const { data: pendingRecords, error } = await supabase
        .from("dns_propagation_queue")
        .select("*")
        .eq("status", "pending")
        .lt("next_check_at", new Date().toISOString())
        .lt("check_count", 100) // Don't check records that have been checked too many times
        .order("next_check_at", { ascending: true })
        .limit(50); // Process 50 records at a time

      if (error) {
        console.error("❌ Error fetching pending DNS records:", error);
        return;
      }

      if (!pendingRecords || pendingRecords.length === 0) {
        console.log("✅ No pending DNS records to check");
        return;
      }

      console.log(`📋 Found ${pendingRecords.length} DNS records to check`);

      // Process each DNS record
      for (const record of pendingRecords) {
        await this.checkDnsRecordPropagation(record);
        
        // Add a small delay between checks to avoid overwhelming DNS servers
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log("✅ Completed DNS propagation check cycle");

    } catch (error) {
      console.error("❌ Error in DNS background check:", error);
    }
  }

  // Check DNS propagation for a specific record from the queue
  async checkDnsRecordPropagation(record) {
    try {
      const fullDomain = `${record.subdomain}.${record.domain}`;
      console.log(`🔍 Checking DNS propagation for: ${fullDomain} (${record.record_type})`);

      // Use the namecheap service to check DNS propagation
      const propagationResult = await namecheapService.checkDnsPropagation(
        record.subdomain,
        record.domain,
        record.record_type,
        record.expected_value
      );

      const newCheckCount = (record.check_count || 0) + 1;
      const updateData = {
        last_check_at: new Date().toISOString(),
        check_count: newCheckCount
      };

      if (propagationResult.success && propagationResult.propagated) {
        // DNS has propagated successfully
        console.log(`✅ DNS propagation confirmed for ${fullDomain}`);
        
        updateData.status = 'confirmed';
        updateData.last_error = null;

        // Update the corresponding subdomain record
        if (record.subdomain_id) {
          await supabase
            .from('subdomains')
            .update({ 
              status: 'active', 
              dns_propagated: true,
              last_checked: new Date().toISOString(),
              dns_error: null
            })
            .eq('id', record.subdomain_id);
        }

        // Remove from propagation queue since it's confirmed
        await supabase
          .from('dns_propagation_queue')
          .delete()
          .eq('id', record.id);

        console.log(`🗑️ Removed ${fullDomain} from propagation queue (confirmed)`);
        return;

      } else if (propagationResult.success && !propagationResult.propagated) {
        // DNS not propagated yet, but no error - schedule next check
        console.log(`⏳ DNS not yet propagated for ${fullDomain} (attempt ${newCheckCount})`);
        
        // Calculate exponential backoff for next check
        const nextDelay = this.calculateBackoffDelay(newCheckCount);
        updateData.next_check_at = new Date(Date.now() + nextDelay).toISOString();
        updateData.last_error = null;
        
        // Check if we've exceeded max retries
        if (newCheckCount >= record.max_retries) {
          console.log(`❌ DNS propagation timed out after ${newCheckCount} attempts for ${fullDomain}`);
          updateData.status = 'failed';
          updateData.last_error = `DNS propagation timeout after ${newCheckCount} attempts`;
          
          // Update subdomain status
          if (record.subdomain_id) {
            await supabase
              .from('subdomains')
              .update({ 
                status: 'failed',
                dns_error: `DNS propagation timeout after ${newCheckCount} attempts`
              })
              .eq('id', record.subdomain_id);
          }
        }

      } else {
        // Error occurred during DNS check
        console.log(`❌ DNS propagation check failed for ${fullDomain}: ${propagationResult.message}`);
        
        const nextDelay = this.calculateBackoffDelay(newCheckCount);
        updateData.next_check_at = new Date(Date.now() + nextDelay).toISOString();
        updateData.last_error = propagationResult.message;
        
        // Check if we've exceeded max retries
        if (newCheckCount >= record.max_retries) {
          updateData.status = 'failed';
          
          // Update subdomain status
          if (record.subdomain_id) {
            await supabase
              .from('subdomains')
              .update({ 
                status: 'failed',
                dns_error: propagationResult.message
              })
              .eq('id', record.subdomain_id);
          }
        }
      }

      // Update the propagation queue record
      const { error: updateError } = await supabase
        .from("dns_propagation_queue")
        .update(updateData)
        .eq("id", record.id);

      if (updateError) {
        console.error(`❌ Error updating DNS propagation record ${fullDomain}:`, updateError);
      }

    } catch (error) {
      console.error(`❌ Error checking propagation for DNS record ${record.id}:`, error);
      
      // Update error status
      await supabase
        .from("dns_propagation_queue")
        .update({
          last_check_at: new Date().toISOString(),
          check_count: (record.check_count || 0) + 1,
          last_error: error.message,
          next_check_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // Retry in 15 minutes
        })
        .eq("id", record.id);
    }
  }

  // Calculate exponential backoff delay
  calculateBackoffDelay(checkCount) {
    // Exponential backoff: 5min, 15min, 45min, 2hr, 6hr, 12hr, 24hr (max)
    const baseDelay = 5 * 60 * 1000; // 5 minutes
    const maxDelay = 24 * 60 * 60 * 1000; // 24 hours
    
    const delay = Math.min(
      baseDelay * Math.pow(3, Math.min(checkCount - 1, 6)), 
      maxDelay
    );
    
    console.log(`⏰ Next check scheduled in ${delay / (60 * 1000)} minutes for attempt ${checkCount}`);
    return delay;
  }

  // Clean up expired records (older than 10 days)
  async cleanupExpiredRecords() {
    try {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      
      console.log(`🧹 Starting cleanup for records older than: ${tenDaysAgo.toISOString()}`);
      
      const { data: expiredRecords, error: selectError } = await supabase
        .from('dns_propagation_queue')
        .select('id, domain, subdomain, created_at')
        .or(`created_at.lt.${tenDaysAgo.toISOString()},status.eq.confirmed`)
        .limit(100);

      if (selectError) {
        console.error("Error selecting expired records:", selectError);
        return;
      }

      if (expiredRecords && expiredRecords.length > 0) {
        const { error: deleteError } = await supabase
          .from('dns_propagation_queue')
          .delete()
          .or(`created_at.lt.${tenDaysAgo.toISOString()},status.eq.confirmed`);

        if (deleteError) {
          console.error("Error cleaning up expired records:", deleteError);
        } else {
          console.log(`🗑️ Cleaned up ${expiredRecords.length} expired/confirmed DNS propagation records`);
        }
      }
    } catch (error) {
      console.error("Error in cleanup process:", error);
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
