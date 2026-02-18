// Ce script s'exécute dans le contexte de la page web (LinkedIn, Indeed, etc.)
// Il écoute les messages venant du popup pour scraper les données.

console.log("JobTracker Content Script loaded");

function scrapeJobData() {
  const url = window.location.href;
  let title = "";
  let company = "";
  let location = "";
  let description = "";

  // ============================================
  // STRATEGY 1: SCHEMA.ORG (JSON-LD)
  // ============================================
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script.innerText);
      // Handle array or single object
      const items = Array.isArray(data) ? data : [data];
      
      for (const item of items) {
        if (item['@type'] === 'JobPosting') {
          console.log("Found JobPosting in JSON-LD:", item);
          if (item.title) title = item.title;
          if (item.hiringOrganization && item.hiringOrganization.name) company = item.hiringOrganization.name;
          if (item.jobLocation) {
             if (item.jobLocation.address && item.jobLocation.address.addressLocality) {
                location = item.jobLocation.address.addressLocality;
             } else if (typeof item.jobLocation === 'string') {
                location = item.jobLocation;
             }
          }
          if (item.description) {
            // Remove HTML tags from description if present
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = item.description;
            description = tempDiv.innerText;
          }
          
          // If we found a valid JobPosting, we can stop here or continue to enhance
          if (title && company) break;
        }
      }
    } catch (e) {
      console.error("Error parsing JSON-LD", e);
    }
  }

  // ============================================
  // STRATEGY 2: SITE SPECIFIC SELECTORS (Overrides)
  // ============================================
  if (!title || !company) {
    if (url.includes("linkedin.com")) {
        // ... (existing LinkedIn logic found in previous version, kept for robustness)
        // 1. Job page (fullscreen)
        const titleEl1 = document.querySelector(".job-details-jobs-unified-top-card__job-title");
        const companyEl1 = document.querySelector(".job-details-jobs-unified-top-card__company-name");
        const locationEl1 = document.querySelector(".job-details-jobs-unified-top-card__bullet");
        const descEl1 = document.querySelector("#job-details");

        // 2. Search results (panel)
        const titleEl2 = document.querySelector(".jobs-search__regions .job-details-jobs-unified-top-card__job-title");
        // Generic
        const titleEl3 = document.querySelector("h1"); 

        if (!title) title = (titleEl1 || titleEl2 || titleEl3)?.innerText.trim() || "";
        if (!company) company = (companyEl1)?.innerText.trim() || "";
        if (!location) location = (locationEl1)?.innerText.trim() || "";
        if (!description) description = (descEl1)?.innerText.trim() || "";

        // Fallback company if not found
        if (!company) {
          const el = document.querySelector(".jobs-unified-top-card__company-name");
          if (el) company = el.innerText.trim();
        }
    } else if (url.includes("welcometothejungle.com")) {
        // ... (existing WTTJ logic)
        const titleEl = document.querySelector("h1");
        if (!title) title = titleEl?.innerText.trim() || "";

        const companyEl = document.querySelector('a[href*="/companies/"] span') || document.querySelector("h1 + div") || document.querySelector("nav li:last-child");
        if (!company) company = companyEl?.innerText.trim() || "";

        const locationEl = document.querySelector('[data-testid="job-location"]');
        if (!location) location = locationEl?.innerText.trim() || "";

        const descEl = document.querySelector('[data-testid="job-section-description"]');
        if (!description) description = descEl?.innerText.trim() || "";

    } else if (url.includes("indeed")) {
        // ... (existing Indeed logic)
         const titleEl = document.querySelector(".jobsearch-JobInfoHeader-title");
         if (!title) title = titleEl?.innerText.trim() || "";

         const companyEl = document.querySelector("[data-testid='inlineHeader-companyName']");
         if (!company) company = companyEl?.innerText.trim() || "";

         const locationEl = document.querySelector("[data-testid='inlineHeader-companyLocation']");
         if (!location) location = locationEl?.innerText.trim() || "";

         const descEl = document.querySelector("#jobDescriptionText");
         if (!description) description = descEl?.innerText.trim() || "";
    } else if (url.includes("apec.fr")) {
         // ... (existing Apec logic)
         const titleEl = document.querySelector("h1");
         if (!title) title = titleEl?.innerText.trim() || "";
         
         const companyEl = document.querySelector(".card-offer__company-name") || document.querySelector(".profile span");
         if (!company) company = companyEl?.innerText.trim() || "";

         const locationEl = document.querySelector(".card-offer__city") || document.querySelector(".job-details-icon-location + span");
         if (!location) location = locationEl?.innerText.trim() || "";

         const descEl = document.querySelector(".details-post-description");
         if (!description) description = descEl?.innerText.trim() || "";
    }
  }

  // ============================================
  // STRATEGY 3: META TAGS & FALLBACKS (Universal)
  // ============================================
  if (!title) {
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) title = ogTitle.content;
    else {
        const h1 = document.querySelector("h1");
        if (h1) title = h1.innerText.trim();
        else title = document.title;
    }
  }

  if (!company) {
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (ogSiteName) company = ogSiteName.content;
    else {
        // Try to guess from Title "Position at Company"
        if (title.includes(" at ")) {
            const parts = title.split(" at ");
            if (parts.length > 1) {
                // Heuristic: Company is likely the last part
                // Check if last part is not too long
                const potentialCompany = parts[parts.length - 1];
                if (potentialCompany.length < 50) company = potentialCompany;
            }
        } else if (title.includes(" chez ")) { // French support
             const parts = title.split(" chez ");
             if (parts.length > 1) {
                const potentialCompany = parts[parts.length - 1];
                if (potentialCompany.length < 50) company = potentialCompany;
             }
        }
    }
    
    if (!company) {
         // Try generic headers often used for company names
        const h2 = document.querySelector("h2");
        if (h2) company = h2.innerText.trim();
    }
  }

  if (!description) {
    const metaDesc = document.querySelector('meta[name="description"]') || document.querySelector('meta[property="og:description"]');
    if (metaDesc) description = metaDesc.content;
    else description = document.body.innerText.substring(0, 1000); 
  }

  // Clean up
  title = title ? title.replace(/\n/g, " ").trim() : "";
  company = company ? company.replace(/\n/g, " ").trim() : "";
  location = location ? location.replace(/\n/g, " ").trim() : "";
  
  // Try to remove " | LinkedIn" or similar suffixes from title if present
  if (title.includes(" | ")) {
    title = title.split(" | ")[0];
  }

  return {
    title,
    company,
    location,
    url,
    description,
    platform: getPlatformName(url)
  };
}



function getPlatformName(url) {
  if (url.includes("linkedin")) return "LinkedIn";
  if (url.includes("indeed")) return "Indeed";
  if (url.includes("welcometothejungle")) return "Welcome to the Jungle";
  if (url.includes("apec")) return "Apec";
  return "Autre";
}

// Écoute les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeJobData();
    sendResponse(data);
  }
});
