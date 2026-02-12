document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('jobForm');
  const messageDiv = document.getElementById('message');
  
  // 1. Au chargement, on demande au content script de scanner la page
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    
    // Injecter script if needed (mais manifest le fait déjà via content_scripts)
    chrome.tabs.sendMessage(activeTab.id, {action: "scrape"}, (response) => {
      if (chrome.runtime.lastError) {
        // Le content script n'est peut-être pas chargé (page non rechargée ou page chrome://)
        console.warn("Impossible de communiquer avec le content script:", chrome.runtime.lastError);
        return;
      }

      if (response) {
        populateForm(response);
      }
    });
  });

  // 2. Remplir le formulaire avec les données scrapées
  function populateForm(data) {
    if (data.title) document.getElementById('title').value = data.title;
    if (data.company) document.getElementById('company').value = data.company;
    if (data.location) document.getElementById('location').value = data.location;
    if (data.url) document.getElementById('url').value = data.url;
  }

  // 3. Soumission du formulaire
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      title: document.getElementById('title').value,
      company: document.getElementById('company').value,
      location: document.getElementById('location').value,
      jobUrl: document.getElementById('url').value,
      status: document.getElementById('status').value, // Par défaut 'Applied' (?)
      dateApplied: new Date().toISOString(),
      // description: ... (on pourrait l'ajouter hidden)
    };

    // Récupérer la config (URL et Token)
    chrome.storage.sync.get({
      jt_apiUrl: 'http://localhost:5000',
      jt_token: ''
    }, async (items) => {
      const { jt_apiUrl, jt_token } = items;

      if (!jt_token) {
        showMessage("Erreur: Token non configuré. Allez dans les options.", "error");
        return;
      }

      try {
        // Construction de l'objet pour l'API backend (JobApplicationCreate)
        // Note: L'API attend des champs en snake_case (date_candidature, type_poste, etc.)
        const payload = {
          poste: formData.title,
          entreprise: formData.company,
          lieu: formData.location, // Envoie directement la valeur, même si vide (le backend gère le None)
          lien: formData.jobUrl, // Correction: url_offre -> lien
          description: "Importé via Chrome Extension", // On pourrait scraper la description complète
          date_candidature: formData.dateApplied,
          reponse: "pending", // Default status
          type_poste: "cdi", // Valeur par défaut, à améliorer avec un select dans le popup
          moyen: "linkedin", // Ou détecter via l'URL
          is_favorite: false
        };

        const response = await fetch(`${jt_apiUrl}/api/applications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jt_token}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("Succès:", result);
        showMessage("Candidature ajoutée avec succès !", "success");
        
        setTimeout(() => {
          window.close();
        }, 1500);

      } catch (error) {
        console.error("Erreur:", error);
        showMessage("Erreur connexion API. Vérifiez l'URL/Token.", "error");
      }
    });
  });

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove('hidden');
  }
});
