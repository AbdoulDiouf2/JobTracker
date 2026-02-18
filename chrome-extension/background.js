// chrome-extension/background.js

// Permet aux utilisateurs d'ouvrir le panneau latéral en cliquant sur l'icône de l'action
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Optionnel: Configurer le panneau pour qu'il s'ouvre sur toutes les pages
// ou restreindre à certains sites si nécessaire pour la confidentialité
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  // Ceci active le side panel pour toutes les urls
  await chrome.sidePanel.setOptions({
    tabId,
    path: 'popup.html',
    enabled: true
  });
});
