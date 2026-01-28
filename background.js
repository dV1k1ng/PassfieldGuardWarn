let supportEmail = "support@example.com";
let requestButtonTitle = "Request to Add to Whitelist";
let emailSubject = "Whitelist Request for Site";
let emailBody = "Dear Admin,\n\nPlease add this site to the whitelist: ${window.location.href}.\n\nThanks!";
let hoverText = "Click to request adding this site to the trusted whitelist.";
let whitelistPatterns = [];  // Array of {original, isWildcard, suffix}

let configLoaded = false;
let configLoadPromise = null;  // Store the promise to avoid duplicate loads
let whitelistUrl = "";

// Parse pattern: store the suffix to match (".baseDomain")
function parsePattern(pattern) {
  const trimmed = pattern.trim().toLowerCase();
  if (trimmed.startsWith("*.")) {
    const base = trimmed.slice(2);  // remove "*."
    return { original: pattern, isWildcard: true, suffix: "." + base };
  } else {
    return { original: pattern, isWildcard: false, suffix: "." + trimmed };
  }
}

// Check if domain matches the pattern
function matchesPattern(domainLower, pattern) {
  if (pattern.isWildcard) {
    // For *.example.com: must end with ".example.com" and have content before it (at least one subdomain)
    return domainLower.endsWith(pattern.suffix) &&
           domainLower.length > pattern.suffix.length;  // ensures prefix exists
  } else {
    // For example.com: exact match OR ends with ".example.com" (subdomains)
    const suffixLen = pattern.suffix.length;
    return domainLower === pattern.suffix.substring(1) ||  // bare domain
           (domainLower.endsWith(pattern.suffix) && 
            domainLower.length > suffixLen);  // subdomain (prefix exists)
  }
}

// Load config (returns a promise that can be reused)
async function loadConfig() {
  // If already loaded, return immediately
  if (configLoaded) {
    return Promise.resolve();
  }
  
  // If currently loading, return the existing promise
  if (configLoadPromise) {
    return configLoadPromise;
  }
  
  // Start loading
  configLoadPromise = (async () => {
    try {
      const configUrl = chrome.runtime.getURL('config.json');
      const response = await fetch(configUrl);
      const config = await response.json();

      whitelistUrl = config.whitelistUrl || "";
      supportEmail = config.supportEmail || supportEmail;
      requestButtonTitle = config.requestButtonTitle || requestButtonTitle;
      emailSubject = config.emailSubject || emailSubject;
      emailBody = config.emailBody || emailBody;
      hoverText = config.hoverText || hoverText;

      if (!whitelistUrl) {
        console.warn("No whitelistUrl in config.json");
        return;
      }

      await loadWhitelist(whitelistUrl);
      configLoaded = true;
      console.log("Config and whitelist fully loaded.");
      
      // Set up periodic refresh (every 60 seconds)
      setInterval(() => loadWhitelist(whitelistUrl), 60000);
    } catch (error) {
      console.error("Error loading config:", error);
      throw error;
    }
  })();
  
  return configLoadPromise;
}

// Load whitelist
async function loadWhitelist(url) {
  try {
    let fullUrl = url.startsWith('http') ? url : chrome.runtime.getURL(url);

    console.log("Loading whitelist from:", fullUrl);
    const response = await fetch(fullUrl);
    const text = await response.text();

    const lines = text.split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith("#"));

    whitelistPatterns = lines.map(parsePattern);

    console.log("Loaded whitelist patterns:", whitelistPatterns.map(p => p.original));
  } catch (error) {
    console.error("Error loading whitelist:", error);
    whitelistPatterns = [];
  }
}

// Check if domain is whitelisted
function isDomainWhitelisted(domain) {
  if (whitelistPatterns.length === 0) return false;

  const domainLower = domain.toLowerCase();

  return whitelistPatterns.some(pattern => {
    const match = matchesPattern(domainLower, pattern);
    if (match) {
      console.log(`MATCH: ${domain} matches pattern ${pattern.original}`);
    }
    return match;
  });
}

// Message listener - ALWAYS wait for config to load before responding
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "isWhitelisted") {
    // Ensure config is loaded before checking whitelist
    loadConfig().then(() => {
      const result = isDomainWhitelisted(message.domain);
      console.log(`Whitelist result for ${message.domain}: ${result}`);
      sendResponse({ isWhitelisted: result });
    }).catch((error) => {
      console.error("Error in isWhitelisted:", error);
      // On error, assume not whitelisted for safety
      sendResponse({ isWhitelisted: false });
    });
    
    return true;  // Keep channel open for async response
    
  } else if (message.action === "getSupportEmail") {
    // Ensure config is loaded before returning support details
    loadConfig().then(() => {
      sendResponse({ 
        supportEmail, 
        requestButtonTitle, 
        emailSubject, 
        emailBody, 
        hoverText 
      });
    }).catch((error) => {
      console.error("Error in getSupportEmail:", error);
      // Return defaults on error
      sendResponse({ 
        supportEmail: "support@example.com", 
        requestButtonTitle: "Request to Add to Whitelist",
        emailSubject: "Whitelist Request for Site",
        emailBody: "Dear Admin,\n\nPlease add this site to the whitelist: ${window.location.href}.\n\nThanks!",
        hoverText: "Click to request adding this site to the trusted whitelist."
      });
    });
    
    return true;  // Keep channel open for async response
  }
});

// Pre-load config when service worker starts
loadConfig().catch(error => {
  console.error("Failed to pre-load config:", error);
});
