const { validationResult } = require("express-validator");
const namecheapService = require("../../services/namecheap.js");

const searchDomains = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const {
      q: query,
      extensions = [".com", ".net", ".org"],
    } = req.query;

    // Basic domain search
    const searchResults = [];
    const extensionArray = Array.isArray(extensions)
      ? extensions
      : extensions.split(",");

    // Check availability for direct matches
    for (const ext of extensionArray) {
      const domain = `${query}${ext}`;
      try {
        // Check domain availability directly with Namecheap API
        const availability = await namecheapService.checkDomainAvailability(domain);
        searchResults.push(availability);
      } catch (error) {
        console.log(`Error checking ${domain}:`, error.message);
        // Add fallback result for failed API calls
        searchResults.push({
          domain,
          available: false,
          price: 0,
          currency: "USD",
          message: "Unable to check availability",
          error: true,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        query,
        directMatches: searchResults,
        searchedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Check single domain availability
const checkAvailability = async (req, res, next) => {
  try {
    const { domain } = req.params;

    if (!domain || domain.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Valid domain name is required",
      });
    }

    // Check domain availability directly with Namecheap API
    const availability = await namecheapService.checkDomainAvailability(domain);

    res.status(200).json({
      success: true,
      data: availability,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchDomains,
  checkAvailability
};

