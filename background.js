let supportEmail = "support@example.com";  // Default email if not configured
let requestButtonTitle = "Request to Add to Whitelist";  // Updated default for your new behavior
let emailSubject = "Whitelist Request for Site";  // Updated default
let emailBody = "Dear Admin,\n\nPlease add this site to the whitelist: ${window.location.href}.\n\nThanks!";  // Updated default
let hoverText = "Click to request adding this site to the trusted whitelist.";  // Add if you want to use in content.js
let whitelist = [];

// A flag to indicate if the configuration has finished loading
let configLoaded = false;
let whitelistUrl = "";  // Initialize without a default URL

// Fetch configuration from bundled JSON file
async function loadConfig() {
  try {
    const configUrl = chrome.runtime.getURL('config.json');
    const response = await fetch(configUrl);
    const config = await response.json();

    console.log("Bundled config file items:", config);  // Log the config items

    // Use values from config file if available
    whitelistUrl = config.whitelistUrl;
    supportEmail = config.supportEmail || supportEmail;
    requestButtonTitle = config.requestButtonTitle || requestButtonTitle;
    emailSubject = config.emailSubject || emailSubject;
    emailBody = config.emailBody || emailBody;
    hoverText = config.hoverText || hoverText;  // Optional, if you add to content.js

    if (!whitelistUrl) {
      throw new Error("whitelistUrl is not defined in config file.");
    }

    console.log("Using whitelist URL:", whitelistUrl);
    console.log("Using support email:", supportEmail);
    console.log("Using request button title:", requestButtonTitle);
    console.log("Using email subject:", emailSubject);
    console.log("Using email body:", emailBody);

    configLoaded = true;  // Mark config as loaded
    await loadWhitelist(whitelistUrl);  // Load the whitelist after fetching config

    // Start periodic update check (if remote)
    setInterval(() => loadWhitelist(whitelistUrl), 60000);  // Check for updates every 1 minute
  } catch (error) {
    console.error("Error loading config:", error);
    // Optional: Fallback to a default whitelistUrl if needed
    // whitelistUrl = chrome.runtime.getURL('data/whitelist.txt');
    // await loadWhitelist(whitelistUrl);
  }
}

// Load the whitelist (handles relative or absolute URLs)
async function loadWhitelist(whitelistUrl) {
  try {
    if (!configLoaded && !whitelistUrl) {
      console.log("Config not loaded and no fallback URL.");
      return; // Don't proceed if no URL
    }
    
    // If relative, convert to full extension URL
    let fullUrl = whitelistUrl;
    if (!whitelistUrl.startsWith('http://') && !whitelistUrl.startsWith('https://') && !whitelistUrl.startsWith('file://')) {
      fullUrl = chrome.runtime.getURL(whitelistUrl);
    }
    
    console.log("Loading whitelist from:", fullUrl);
    const response = await fetch(fullUrl);
    const text = await response.text();
    console.log("Whitelist content:", text);
    whitelist = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    console.log("Parsed whitelist:", whitelist);
  } catch (error) {
    console.error("Error loading whitelist:", error);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "isWhitelisted") {
    console.log("Received domain check request for:", message.domain);
    console.log("Current whitelist:", whitelist);  // Log for debugging
    const isWhitelisted = whitelist.includes(message.domain);
    console.log(`Checking if ${message.domain} is whitelisted:`, isWhitelisted);
    sendResponse({ isWhitelisted });
  } else if (message.action === "getSupportEmail") {
    if (configLoaded) {
      sendResponse({ supportEmail, requestButtonTitle, emailSubject, emailBody, hoverText });
    } else {
      sendResponse({ supportEmail: "support@example.com", requestButtonTitle, emailSubject, emailBody, hoverText });  // Fallback
    }
  }
  return true;  // Keep the message channel open for async
});

// Load the config on startup
loadConfig();

