// Ce script s'exécute dans le contexte de la page web (LinkedIn, Indeed, etc.)
// Il écoute les messages venant du popup pour scraper les données.

console.log("JobTracker Content Script loaded");

function scrapeJobData() {
  const url = window.location.href;
  let title = "";
  let company = "";
  let location = "";
  let description = "";

  // Détection basique pour LinkedIn (à affiner)
  if (url.includes("linkedin.com")) {
    // Selecteurs CSS spécifiques à LinkedIn (peuvent changer, à maintenir)
    const titleElement = document.querySelector(".job-details-jobs-unified-top-card__job-title") || document.querySelector("h1");
    const companyElement = document.querySelector(".job-details-jobs-unified-top-card__company-name") || document.querySelector(".topcard__org-name-link");
    const locationElement = document.querySelector(".job-details-jobs-unified-top-card__bullet") 
      || document.querySelector(".topcard__flavor--bullet")
      || document.querySelector(".job-details-jobs-unified-top-card__workplace-type")
      || document.querySelector(".job-details-jobs-unified-top-card__company-location")
      || document.querySelector(".job-details-jobs-unified-top-card__bullet:nth-of-type(1)"); // Parfois c'est le 1er bullet
    const descriptionElement = document.querySelector("#job-details") || document.querySelector(".description__text");

    if (titleElement) title = titleElement.innerText.trim();
    if (companyElement) company = companyElement.innerText.trim();
    if (locationElement) location = locationElement.innerText.trim();
    if (descriptionElement) description = descriptionElement.innerText.trim();
  } 
  // Détection basique pour Welcome to the Jungle
  else if (url.includes("welcometothejungle.com")) {
    const titleElement = document.querySelector("h1");
    // WTTJ structure is complex, often needs specific selectors
    if (titleElement) title = titleElement.innerText.trim();
     // TODO: Add more specific selectors for WTTJ
  }
  // Fallback générique (essaie de deviner)
  else {
    const h1 = document.querySelector("h1");
    if (h1) title = h1.innerText.trim();
    description = document.body.innerText.substring(0, 500); // Prend le début du texte
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
  return "Autre";
}

// Écoute les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    const data = scrapeJobData();
    sendResponse(data);
  }
});
