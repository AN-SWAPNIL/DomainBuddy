const { validationResult } = require("express-validator");
const supabase = require("../config/database.js");
const namecheapService = require("../services/namecheapService.js");

// Helper function to validate domain ownership
const validateDomainOwnership = async (domainId, userId) => {
  const { data: domain, error } = await supabase
    .from("domains")
    .select("id, full_domain, status")
    .eq("id", domainId)
    .eq("owner_id", userId)
    .single();

  if (error || !domain) {
    throw new Error("Domain not found or access denied");
  }

  if (domain.status !== "active" && domain.status !== "pending" && domain.status !== "registered") {
    throw new Error("Domain must be active or registered to manage subdomains");
  }

  return domain;
};

// Helper function to validate target value based on record type
const validateTargetValue = (recordType, targetValue) => {
  switch (recordType) {
    case 'A':
      // IPv4 validation
      const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipv4Regex.test(targetValue)) {
        throw new Error('Invalid IPv4 address for A record');
      }
      break;
    
    case 'AAAA':
      // IPv6 validation (basic)
      if (!targetValue.includes(':') || targetValue.length < 3) {
        throw new Error('Invalid IPv6 address for AAAA record');
      }
      break;
    
    case 'CNAME':
      // Domain name validation
      if (!targetValue.includes('.') || targetValue.endsWith('.')) {
        throw new Error('Invalid domain name for CNAME record');
      }
      break;
    
    case 'MX':
      // Domain name validation for MX
      if (!targetValue.includes('.') || targetValue.endsWith('.')) {
        throw new Error('Invalid mail server domain for MX record');
      }
      break;
    
    case 'TXT':
      // TXT records can contain any text, just check it's not empty
      if (!targetValue.trim()) {
        throw new Error('TXT record cannot be empty');
      }
      break;
    
    default:
      // For SRV, NS and other types, basic validation
      if (!targetValue.trim()) {
        throw new Error('Target value cannot be empty');
      }
  }
};

// Get all subdomains for a domain
const getSubdomains = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domainId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Validate domain ownership
    const domain = await validateDomainOwnership(domainId, req.user.id);

    // Get subdomains with pagination
    const { data: subdomains, error: subdomainsError } = await supabase
      .from("subdomains")
      .select("*")
      .eq("domain_id", domainId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (subdomainsError) {
      console.error("Error fetching subdomains:", subdomainsError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch subdomains",
      });
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("subdomains")
      .select("*", { count: "exact", head: true })
      .eq("domain_id", domainId)
      .eq("is_active", true);

    if (countError) {
      console.error("Error counting subdomains:", countError);
    }

    res.status(200).json({
      success: true,
      data: {
        subdomains: subdomains || [],
        domain: domain,
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get subdomains error:", error);
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// Get specific subdomain details
const getSubdomainDetails = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domainId, subdomainId } = req.params;

    // Validate domain ownership
    const domain = await validateDomainOwnership(domainId, req.user.id);

    // Get subdomain details
    const { data: subdomain, error: subdomainError } = await supabase
      .from("subdomains")
      .select("*")
      .eq("id", subdomainId)
      .eq("domain_id", domainId)
      .single();

    if (subdomainError || !subdomain) {
      return res.status(404).json({
        success: false,
        message: "Subdomain not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        subdomain,
        domain,
      },
    });
  } catch (error) {
    console.error("Get subdomain details error:", error);
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// Create a new subdomain
const createSubdomain = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domainId } = req.params;
    const { 
      subdomain_name, 
      record_type, 
      target_value, 
      ttl = 3600, 
      priority,
      port,
      weight 
    } = req.body;

    // Validate domain ownership
    const domain = await validateDomainOwnership(domainId, req.user.id);

    // Validate target value based on record type
    validateTargetValue(record_type, target_value);

    // Check if subdomain already exists
    const { data: existingSubdomain, error: checkError } = await supabase
      .from("subdomains")
      .select("id")
      .eq("domain_id", domainId)
      .eq("subdomain_name", subdomain_name.toLowerCase())
      .eq("is_active", true)
      .single();

    if (existingSubdomain) {
      return res.status(409).json({
        success: false,
        message: `Subdomain '${subdomain_name}' already exists for this domain`,
      });
    }

    // Create subdomain record
    const subdomainData = {
      domain_id: domainId,
      subdomain_name: subdomain_name.toLowerCase(),
      record_type,
      target_value: target_value.trim(),
      ttl: parseInt(ttl),
      status: 'pending',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Add optional fields if provided
    if (priority !== undefined && (record_type === 'MX' || record_type === 'SRV')) {
      subdomainData.priority = parseInt(priority);
    }
    if (port !== undefined && record_type === 'SRV') {
      subdomainData.port = parseInt(port);
    }
    if (weight !== undefined && record_type === 'SRV') {
      subdomainData.weight = parseInt(weight);
    }

    const { data: newSubdomain, error: createError } = await supabase
      .from("subdomains")
      .insert([subdomainData])
      .select()
      .single();

    if (createError) {
      console.error("Subdomain creation error:", createError);
      
      if (createError.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "Subdomain already exists",
        });
      }
      
      return res.status(500).json({
        success: false,
        message: "Failed to create subdomain",
      });
    }

    // TODO: In a real implementation, you might want to create the DNS record 
    // with your DNS provider (Namecheap) here
    
    // For now, we'll just mark it as active since we're simulating
    const { error: updateError } = await supabase
      .from("subdomains")
      .update({ 
        status: 'active',
        dns_propagated: true,
        last_checked: new Date().toISOString()
      })
      .eq("id", newSubdomain.id);

    if (updateError) {
      console.error("Error updating subdomain status:", updateError);
    }

    // Fetch the complete subdomain data
    const { data: completeSubdomain } = await supabase
      .from("subdomains")
      .select("*")
      .eq("id", newSubdomain.id)
      .single();

    res.status(201).json({
      success: true,
      data: {
        subdomain: completeSubdomain || newSubdomain,
        message: `Subdomain '${subdomain_name}.${domain.full_domain}' created successfully`,
      },
    });
  } catch (error) {
    console.error("Create subdomain error:", error);
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("Invalid")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// Update an existing subdomain
const updateSubdomain = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domainId, subdomainId } = req.params;
    const updateData = req.body;

    // Validate domain ownership
    const domain = await validateDomainOwnership(domainId, req.user.id);

    // Get existing subdomain
    const { data: existingSubdomain, error: fetchError } = await supabase
      .from("subdomains")
      .select("*")
      .eq("id", subdomainId)
      .eq("domain_id", domainId)
      .single();

    if (fetchError || !existingSubdomain) {
      return res.status(404).json({
        success: false,
        message: "Subdomain not found",
      });
    }

    // Validate target value if record type or target value is being updated
    const newRecordType = updateData.record_type || existingSubdomain.record_type;
    const newTargetValue = updateData.target_value || existingSubdomain.target_value;
    
    if (updateData.record_type || updateData.target_value) {
      validateTargetValue(newRecordType, newTargetValue);
    }

    // Check for subdomain name conflicts if name is being changed
    if (updateData.subdomain_name && updateData.subdomain_name !== existingSubdomain.subdomain_name) {
      const { data: conflictSubdomain } = await supabase
        .from("subdomains")
        .select("id")
        .eq("domain_id", domainId)
        .eq("subdomain_name", updateData.subdomain_name.toLowerCase())
        .eq("is_active", true)
        .neq("id", subdomainId)
        .single();

      if (conflictSubdomain) {
        return res.status(409).json({
          success: false,
          message: `Subdomain '${updateData.subdomain_name}' already exists for this domain`,
        });
      }
    }

    // Prepare update data
    const subdomainUpdateData = {
      ...updateData,
      updated_at: new Date().toISOString(),
      status: 'pending', // Mark as pending while updating
    };

    // Clean up undefined values
    Object.keys(subdomainUpdateData).forEach(key => {
      if (subdomainUpdateData[key] === undefined) {
        delete subdomainUpdateData[key];
      }
    });

    // Convert subdomain_name to lowercase if provided
    if (subdomainUpdateData.subdomain_name) {
      subdomainUpdateData.subdomain_name = subdomainUpdateData.subdomain_name.toLowerCase();
    }

    // Convert numeric fields
    if (subdomainUpdateData.ttl) {
      subdomainUpdateData.ttl = parseInt(subdomainUpdateData.ttl);
    }
    if (subdomainUpdateData.priority !== undefined) {
      subdomainUpdateData.priority = parseInt(subdomainUpdateData.priority);
    }

    // Update subdomain
    const { data: updatedSubdomain, error: updateError } = await supabase
      .from("subdomains")
      .update(subdomainUpdateData)
      .eq("id", subdomainId)
      .eq("domain_id", domainId)
      .select()
      .single();

    if (updateError) {
      console.error("Subdomain update error:", updateError);
      return res.status(500).json({
        success: false,
        message: "Failed to update subdomain",
      });
    }

    // TODO: Update DNS record with provider (Namecheap)
    
    // For now, mark as active
    const { error: statusUpdateError } = await supabase
      .from("subdomains")
      .update({ 
        status: 'active',
        last_checked: new Date().toISOString()
      })
      .eq("id", subdomainId);

    if (statusUpdateError) {
      console.error("Error updating subdomain status:", statusUpdateError);
    }

    // Fetch the complete updated subdomain data
    const { data: completeSubdomain } = await supabase
      .from("subdomains")
      .select("*")
      .eq("id", subdomainId)
      .single();

    res.status(200).json({
      success: true,
      data: {
        subdomain: completeSubdomain || updatedSubdomain,
        message: "Subdomain updated successfully",
      },
    });
  } catch (error) {
    console.error("Update subdomain error:", error);
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    if (error.message.includes("Invalid")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

// Delete a subdomain
const deleteSubdomain = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { domainId, subdomainId } = req.params;

    // Validate domain ownership
    const domain = await validateDomainOwnership(domainId, req.user.id);

    // Get subdomain to delete
    const { data: subdomainToDelete, error: fetchError } = await supabase
      .from("subdomains")
      .select("*")
      .eq("id", subdomainId)
      .eq("domain_id", domainId)
      .single();

    if (fetchError || !subdomainToDelete) {
      return res.status(404).json({
        success: false,
        message: "Subdomain not found",
      });
    }

    // TODO: Delete DNS record from provider (Namecheap)

    // Soft delete by marking as inactive
    const { error: deleteError } = await supabase
      .from("subdomains")
      .update({ 
        is_active: false,
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq("id", subdomainId)
      .eq("domain_id", domainId);

    if (deleteError) {
      console.error("Subdomain delete error:", deleteError);
      return res.status(500).json({
        success: false,
        message: "Failed to delete subdomain",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: `Subdomain '${subdomainToDelete.subdomain_name}.${domain.full_domain}' deleted successfully`,
      },
    });
  } catch (error) {
    console.error("Delete subdomain error:", error);
    if (error.message.includes("not found") || error.message.includes("access denied")) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

module.exports = {
  getSubdomains,
  getSubdomainDetails,
  createSubdomain,
  updateSubdomain,
  deleteSubdomain,
};
