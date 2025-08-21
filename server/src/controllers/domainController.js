const { validationResult } = require("express-validator");
const namecheapService = require("../services/namecheapService.js");
const supabase = require("../config/database.js");

// Cleanup function to delete pending domains/transactions after 1 minute
const cleanupPendingRecords = async () => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    console.log(`🧹 Starting cleanup for records older than: ${oneMinuteAgo}`);

    // First, delete all pending transactions older than 1 minute
    const { data: expiredTransactions, error: transactionError } =
      await supabase
        .from("transactions")
        .delete()
        .eq("status", "pending")
        .lt("created_at", oneMinuteAgo)
        .select("id, domain_id");

    if (transactionError) {
      console.error("Error cleaning up transactions:", transactionError);
    } else if (expiredTransactions && expiredTransactions.length > 0) {
      console.log(
        `🗑️ Deleted ${expiredTransactions.length} pending transactions`
      );
    }

    // Then, delete all pending domains older than 1 minute (regardless of transaction status)
    const { data: expiredDomains, error: domainError } = await supabase
      .from("domains")
      .delete()
      .eq("status", "pending")
      .lt("created_at", oneMinuteAgo)
      .select("id, full_domain");

    if (domainError) {
      console.error("Error cleaning up domains:", domainError);
    } else if (expiredDomains && expiredDomains.length > 0) {
      console.log(
        `🗑️ Deleted ${expiredDomains.length} pending domains:`,
        expiredDomains.map((d) => d.full_domain).join(", ")
      );
    }

    // Log summary
    const totalCleaned =
      (expiredTransactions?.length || 0) + (expiredDomains?.length || 0);
    if (totalCleaned > 0) {
      console.log(
        `✅ Cleanup completed: ${totalCleaned} total records removed`
      );
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

// Start cleanup interval when module loads
setInterval(cleanupPendingRecords, 30000); // Run every 30 seconds

// Search domains (public route)
const searchDomains = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { q: query, extensions = [".com", ".net", ".org"] } = req.query;

    console.log(`🔍 Searching domains for: ${query} with extensions: ${extensions}`);

    // Basic domain search
    const searchResults = [];
    const extensionArray = Array.isArray(extensions)
      ? extensions
      : extensions.split(",");

    // Limit extensions to prevent too many API calls
    const limitedExtensions = extensionArray.slice(0, 5);

    // Check availability for direct matches with Promise.allSettled for better error handling
    const domainChecks = limitedExtensions.map(async (ext) => {
      const domain = `${query}${ext}`;
      try {
        // Set a timeout for individual domain checks
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Domain check timeout')), 15000);
        });

        const availability = await Promise.race([
          namecheapService.checkDomainAvailability(domain),
          timeoutPromise
        ]);

        return {
          domain,
          ...availability,
          success: true
        };
      } catch (error) {
        console.log(`⚠️ Error checking ${domain}:`, error.message);
        // Add fallback result for failed API calls
        return {
          domain,
          available: false,
          price: 12.99,
          currency: "USD",
          isPremium: false,
          message: "Unable to check availability",
          error: true,
          success: false
        };
      }
    });

    // Wait for all domain checks with a timeout
    const results = await Promise.allSettled(domainChecks);
    
    // Process results
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        searchResults.push(result.value);
      } else {
        console.log('Domain check promise rejected:', result.reason);
        // Add fallback for rejected promises
        searchResults.push({
          domain: `${query}.com`,
          available: false,
          price: 12.99,
          currency: "USD",
          isPremium: false,
          message: "Service temporarily unavailable",
          error: true,
          success: false
        });
      }
    });

    console.log(`✅ Domain search completed for ${query}, found ${searchResults.length} results`);

    res.status(200).json({
      success: true,
      data: {
        query,
        results: searchResults,
      },
    });
  } catch (error) {
    console.error("Domain search error:", error);
    
    // Return a fallback response even if there's an error
    res.status(200).json({
      success: true,
      data: {
        query: req.query.q || "unknown",
        results: [{
          domain: `${req.query.q || "example"}.com`,
          available: false,
          price: 12.99,
          currency: "USD",
          isPremium: false,
          message: "Service temporarily unavailable",
          error: true,
          success: false
        }]
      },
    });
  }
};

// Check availability for a specific domain (public route)
const checkAvailability = async (req, res, next) => {
  try {
    const { domain } = req.params;

    if (!domain) {
      return res.status(400).json({
        success: false,
        message: "Domain parameter is required",
      });
    }

    const availability = await namecheapService.checkDomainAvailability(domain);

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    console.error("Domain availability check error:", error);
    next(error);
  }
};

// Purchase domain (protected route)
const purchaseDomain = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domain } = req.body;

    // Check if domain is available
    const availability = await namecheapService.checkDomainAvailability(domain);

    if (!availability.available) {
      return res.status(400).json({
        success: false,
        message: "Domain is not available for registration",
      });
    }

    // Create domain record in Supabase
    const domainParts = domain.split(".");
    const domainName = domainParts[0];
    const extension = domainParts.slice(1).join("."); // Handle multi-part extensions like .co.uk

    const cost = availability.price;
    const markup = cost * 0; // 10% markup
    const sellingPrice = cost * 1;

    const { data: newDomain, error: domainError } = await supabase
      .from("domains")
      .insert([
        {
          name: domainName,
          extension: extension,
          full_domain: domain.toLowerCase(),
          owner_id: req.user.id,
          status: "pending",
          registrar: "namecheap",
          cost: cost,
          markup: markup,
          selling_price: sellingPrice,
          currency: "USD",
          is_premium: availability.isPremium || false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (domainError) {
      console.error("Domain creation error:", domainError);

      // Handle duplicate domain constraint
      if (
        domainError.code === "23505" &&
        domainError.details?.includes("full_domain")
      ) {
        return res.status(400).json({
          success: false,
          message: `Domain ${domain} has already been purchased or is in our system`,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create domain record",
      });
    }

    // Create transaction record in Supabase
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert([
        {
          user_id: req.user.id,
          domain_id: newDomain.id,
          type: "purchase",
          status: "pending",
          amount: sellingPrice,
          currency: "USD",
          payment_method: "stripe",
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (transactionError) {
      console.error("Transaction creation error:", transactionError);
      return res.status(500).json({
        success: false,
        message: "Failed to create transaction record",
      });
    }

    res.status(201).json({
      success: true,
      data: {
        domain: newDomain,
        transaction,
        message: "Domain purchase initiated. Complete payment to finalize.",
      },
    });
  } catch (error) {
    console.error("Domain purchase error:", error);
    next(error);
  }
};

// Get user domains (protected route)
const getUserDomains = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Get user's domains with pagination
    const { data: domains, error: domainsError } = await supabase
      .from("domains")
      .select(
        `
        *,
        transactions!transactions_domain_id_fkey(*)
      `
      )
      .eq("owner_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (domainsError) {
      console.error("Error fetching user domains:", domainsError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch domains",
      });
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("domains")
      .select("*", { count: "exact", head: true })
      .eq("owner_id", req.user.id);

    if (countError) {
      console.error("Error counting domains:", countError);
      return res.status(500).json({
        success: false,
        message: "Failed to count domains",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        domains: domains || [],
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get user domains error:", error);
    next(error);
  }
};

module.exports = {
  searchDomains,
  checkAvailability,
  purchaseDomain,
  getUserDomains,
};
