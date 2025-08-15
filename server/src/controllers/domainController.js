const { validationResult } = require("express-validator");
const namecheapService = require("../services/namecheapService.js");
const supabase = require("../config/database.js");

// Cleanup function to delete pending domains/transactions after 1 minute
const cleanupPendingRecords = async () => {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

    // Delete pending transactions older than 1 minute
    const { data: expiredTransactions, error: transactionError } =
      await supabase
        .from("transactions")
        .delete()
        .eq("status", "pending")
        .lt("created_at", oneMinuteAgo)
        .select("id, domain_id");

    if (transactionError) {
      console.error("Error cleaning up transactions:", transactionError);
      return;
    }

    // Delete corresponding domains
    if (expiredTransactions && expiredTransactions.length > 0) {
      const domainIds = expiredTransactions.map((t) => t.domain_id);

      const { error: domainError } = await supabase
        .from("domains")
        .delete()
        .in("id", domainIds)
        .eq("status", "pending");

      if (domainError) {
        console.error("Error cleaning up domains:", domainError);
      } else {
        console.log(`Cleaned up ${expiredTransactions.length} pending records`);
      }
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
};

// Start cleanup interval when module loads
setInterval(cleanupPendingRecords, 30000); // Run every 30 seconds

// Purchase domain
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

    const cost = availability.price || 12.99;
    const markup = cost * 0.1; // 10% markup
    const sellingPrice = cost * 1.1;

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
    next(error);
  }
};

// Get user's domains
const getUserDomains = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "created_at",
      order = "desc",
    } = req.query;

    // Build query
    let query = supabase.from("domains").select(`
      *,
      users!domains_owner_id_fkey(name, email)
    `);

    // Filter by owner
    query = query.eq("owner_id", req.user.id);

    // Always exclude pending status domains
    query = query.neq("status", "pending");

    // Filter by status if provided (but not pending)
    if (status && status !== "pending") {
      query = query.eq("status", status);
    }

    // Apply sorting
    const sortOrder =
      order === "desc" ? { ascending: false } : { ascending: true };
    query = query.order(sortBy, sortOrder);

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: domains, error, count } = await query;

    if (error) {
      console.error("Error fetching domains:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch domains",
      });
    }

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    res.status(200).json({
      success: true,
      data: {
        docs: domains,
        totalDocs: count,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? parseInt(page) + 1 : null,
        prevPage: hasPrevPage ? parseInt(page) - 1 : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  purchaseDomain,
  getUserDomains,
  cleanupPendingRecords,
};
