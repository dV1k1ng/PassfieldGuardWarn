let supportEmail = "support@example.com";
let requestButtonTitle = "Request to Add to Whitelist";
let emailSubject = "Whitelist Request for Site";
let emailBody = "Dear Admin,\n\nPlease add this site to the whitelist: ${window.location.href}.\n\nThanks!";
let hoverText = "Click to request adding this site to the trusted whitelist.";
let whitelistPatterns = [];  // Array of {original, isWildcard, suffix}

let configLoaded = false;
let isLoading = false;  // Prevent concurrent loads
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

// Load config (now returns a promise for awaiting)
async function loadConfig() {
  if (isLoading || configLoaded) return;  // Skip if already loading or loaded
  isLoading = true;
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
      isLoading = false;
      return;
    }

    await loadWhitelist(whitelistUrl);
    configLoaded = true;
    console.log("Config and whitelist fully loaded.");
    setInterval(() => loadWhitelist(whitelistUrl), 60000);
  } catch (error) {
    console.error("Error loading config:", error);
  } finally {
    isLoading = false;
  }
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

// Message listener (now async to await loading)
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === "isWhitelisted") {
    if (!configLoaded) {
      await loadConfig();
    }
    const result = isDomainWhitelisted(message.domain);
    console.log(`Whitelist result for ${message.domain}: ${result}`);
    sendResponse({ isWhitelisted: result });
  } else if (message.action === "getSupportEmail") {
    if (!configLoaded) {
      await loadConfig();
    }
    sendResponse({ supportEmail, requestButtonTitle, emailSubject, emailBody, hoverText });
  }
  return true;  // Keep channel open for async
});

// Startup: Kick off initial load
loadConfig();
