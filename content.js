// Debounce function to limit the frequency of function calls
function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

const currentDomain = window.location.hostname;
let warningBarAdded = false;

// Create the warning bar element
function createWarningBar() {
  const bar = document.createElement("div");
  bar.id = "passfieldguard-warning-bar";
  bar.style.position = "fixed";
  bar.style.top = "0";
  bar.style.left = "0";
  bar.style.width = "100%";
  bar.style.backgroundColor = "#ff4444";
  bar.style.color = "white";
  bar.style.padding = "12px 20px";
  bar.style.fontFamily = "Arial, sans-serif";
  bar.style.fontSize = "14px";
  bar.style.textAlign = "center";
  bar.style.zIndex = "999999";
  bar.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)";
  bar.style.display = "flex";
  bar.style.justifyContent = "center";
  bar.style.alignItems = "center";
  bar.style.gap = "20px";

  const message = document.createElement("span");
  message.textContent = `⚠ Warning: This site (${currentDomain}) is not on the trusted whitelist. Entering passwords here may be risky.`;
  bar.appendChild(message);

  const requestButton = document.createElement("button");
  requestButton.textContent = "Request to Add to Whitelist";
  requestButton.style.padding = "8px 16px";
  requestButton.style.backgroundColor = "white";
  requestButton.style.color = "#ff4444";
  requestButton.style.border = "none";
  requestButton.style.borderRadius = "4px";
  requestButton.style.cursor = "pointer";
  requestButton.style.fontWeight = "bold";

  // Fetch email details from background script
  chrome.runtime.sendMessage({ action: "getSupportEmail" }, (response) => {
    const supportEmail = response && response.supportEmail ? response.supportEmail : "support@example.com";
    const requestButtonTitle = response && response.requestButtonTitle ? response.requestButtonTitle : "Request to unlock";
    const emailSubject = response && response.emailSubject ? response.emailSubject : "Request to unlock password field";
    const emailBody = response && response.emailBody ? response.emailBody : `Dear Admin,\n\nI would like to request adding the website ${window.location.href} to the password whitelist.\n\nThank you!`;
    const hoverText = response && response.hoverText ? response.hoverText : "Click to request adding this site to the trusted whitelist.";

    requestButton.title = hoverText;
    requestButton.textContent = requestButtonTitle;

    const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody + "\n\nSite: " + window.location.href)}`;

    requestButton.addEventListener("click", () => {
      window.location.href = mailtoLink;
    });
  });

  bar.appendChild(requestButton);
  return bar;
}

// Check if the page has any password fields (robust selector)
function hasPasswordFields(doc) {
  const selectors = 'input[type="password"], input[class*="password" i], input[id*="password" i]';
  return doc.querySelector(selectors) !== null;
}

// Main logic
chrome.runtime.sendMessage({ action: "isWhitelisted", domain: currentDomain }, (response) => {
  if (response && response.isWhitelisted === false) {
    // Check current document
    if (hasPasswordFields(document)) {
      document.body.insertBefore(createWarningBar(), document.body.firstChild);
      warningBarAdded = true;
    }

    // Observe for dynamic content (new password fields appearing later)
    const observer = new MutationObserver(debounce(() => {
      if (!warningBarAdded && hasPasswordFields(document)) {
        document.body.insertBefore(createWarningBar(), document.body.firstChild);
        warningBarAdded = true;
      }
    }, 500));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also handle iframes (basic support)
    document.querySelectorAll("iframe").forEach((iframe) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc && hasPasswordFields(iframeDoc)) {
          if (!warningBarAdded) {
            document.body.insertBefore(createWarningBar(), document.body.firstChild);
            warningBarAdded = true;
          }
        }
      } catch (e) {
        // Cross-origin iframe – can't access
      }
    });
  }
});
