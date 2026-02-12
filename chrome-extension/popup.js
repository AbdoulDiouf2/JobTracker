document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('jobForm');
  const messageDiv = document.getElementById('message');
  const extractBtn = document.getElementById('extractBtn');
  const loadingDiv = document.getElementById('loading');
  
  // Form fields
  const titleInput = document.getElementById('title');
  const companyInput = document.getElementById('company');
  const locationInput = document.getElementById('location');
  const urlInput = document.getElementById('url');
  const typeSelect = document.getElementById('type');
  const salaryMinInput = document.getElementById('salaryMin');
  const salaryMaxInput = document.getElementById('salaryMax');
  const descriptionInput = document.getElementById('description');
  const competencesInput = document.getElementById('competences');
  const experienceInput = document.getElementById('experience');

  // Get current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) urlInput.value = activeTab.url;
  });

  // AI Extraction button
  extractBtn.addEventListener('click', async () => {
    loadingDiv.classList.remove('hidden');
    loadingDiv.textContent = 'Extraction IA en cours...';
    extractBtn.disabled = true;

    try {
      // Get page content from content script
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      const pageContent = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: () => {
          // Get main content, avoiding scripts and styles
          const body = document.body.cloneNode(true);
          body.querySelectorAll('script, style, noscript, iframe').forEach(el => el.remove());
          return body.innerText.substring(0, 20000); // Limit content
        }
      });

      const content = pageContent[0]?.result || '';
      
      // Get config
      const config = await chrome.storage.sync.get({
        jt_apiUrl: 'http://localhost:5000',
        jt_token: ''
      });

      if (!config.jt_token) {
        showMessage("Erreur: Token non configuré. Allez dans les options.", "error");
        return;
      }

      // Call AI extraction endpoint
      const response = await fetch(`${config.jt_apiUrl}/api/ai/extract-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.jt_token}`
        },
        body: JSON.stringify({
          page_content: content,
          page_url: tab.url
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Populate form with extracted data
      if (data.poste) titleInput.value = data.poste;
      if (data.entreprise) companyInput.value = data.entreprise;
      if (data.lieu) locationInput.value = data.lieu;
      if (data.type_poste) typeSelect.value = data.type_poste;
      if (data.salaire_min) salaryMinInput.value = data.salaire_min;
      if (data.salary_max) salaryMaxInput.value = data.salary_max; // Handle possible small diff in field names
      if (data.salaire_max) salaryMaxInput.value = data.salaire_max;
      if (data.description_poste) descriptionInput.value = data.description_poste;
      if (data.experience_requise) experienceInput.value = data.experience_requise;
      if (data.competences && data.competences.length > 0) {
        competencesInput.value = data.competences.join(', ');
      }

      const confidence = Math.round(data.confidence_score * 100);
      showMessage(`Extraction réussie ! (Confiance: ${confidence}%)`, "success");

    } catch (error) {
      console.error("Extraction error:", error);
      showMessage(`Erreur: ${error.message}`, "error");
    } finally {
      loadingDiv.classList.add('hidden');
      extractBtn.disabled = false;
    }
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
      poste: titleInput.value,
      entreprise: companyInput.value,
      lieu: locationInput.value || null,
      lien: urlInput.value,
      type_poste: typeSelect.value,
      salaire_min: salaryMinInput.value ? parseInt(salaryMinInput.value) : null,
      salaire_max: salaryMaxInput.value ? parseInt(salaryMaxInput.value) : null,
      description_poste: descriptionInput.value || null,
      competences: competencesInput.value ? competencesInput.value.split(',').map(s => s.trim()).filter(s => s !== "") : [],
      experience_requise: experienceInput.value || null,
      date_candidature: new Date().toISOString(),
      reponse: "pending",
      moyen: detectPlatform(urlInput.value),
      is_favorite: false
    };

    // Validate required fields
    if (!formData.entreprise || !formData.poste) {
      showMessage("Entreprise et Poste sont requis !", "error");
      return;
    }

    const config = await chrome.storage.sync.get({
      jt_apiUrl: 'http://localhost:5000',
      jt_token: ''
    });

    if (!config.jt_token) {
      showMessage("Erreur: Token non configuré. Allez dans les options.", "error");
      return;
    }

    try {
      loadingDiv.classList.remove('hidden');
      loadingDiv.textContent = 'Enregistrement...';

      const response = await fetch(`${config.jt_apiUrl}/api/applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.jt_token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      
      showMessage("Candidature ajoutée avec succès !", "success");
      
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error("Save error:", error);
      showMessage(`Erreur: ${error.message}`, "error");
    } finally {
      loadingDiv.classList.add('hidden');
    }
  });

  function detectPlatform(url) {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin')) return 'linkedin';
    if (lowerUrl.includes('indeed')) return 'indeed';
    if (lowerUrl.includes('welcometothejungle')) return 'welcome_to_jungle';
    if (lowerUrl.includes('apec')) return 'apec';
    if (lowerUrl.includes('pole-emploi') || lowerUrl.includes('francetravail')) return 'pole_emploi';
    return 'other';
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove('hidden');
  }
});
