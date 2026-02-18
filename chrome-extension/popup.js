// JobTracker Chrome Extension - popup.js
// Handles authentication and job saving

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Auth
  const authSection = document.getElementById('authSection');
  const mainSection = document.getElementById('mainSection');
  const loginForm = document.getElementById('loginForm');
  const codeForm = document.getElementById('codeForm');
  const authTabs = document.querySelectorAll('.auth-tab');
  const authMessage = document.getElementById('authMessage');
  const logoutBtn = document.getElementById('logoutBtn');
  const userNameSpan = document.getElementById('userName');
  
  // DOM Elements - Main
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

  // ============================================
  // INITIALIZATION
  // ============================================
  
  // Check if already logged in
  const config = await chrome.storage.sync.get({
    jt_apiUrl: '',
    jt_token: '',
    jt_userEmail: '',
    jt_userName: ''
  });

  // Auto-detect API URL if not set
  if (!config.jt_apiUrl) {
    config.jt_apiUrl = 'https://job-tracker-steel-eight.vercel.app';
    await chrome.storage.sync.set({ jt_apiUrl: config.jt_apiUrl });
  }

  if (config.jt_token) {
    // Validate token is still valid
    const isValid = await validateToken(config.jt_apiUrl, config.jt_token);
    if (isValid) {
      showMainSection(config.jt_userName || config.jt_userEmail || 'Utilisateur');
    } else {
      // Token expired, clear it
      await chrome.storage.sync.remove(['jt_token', 'jt_userEmail', 'jt_userName']);
      showAuthSection();
    }
  } else {
    showAuthSection();
  }

  // Get current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) urlInput.value = activeTab.url;
  });

  // ============================================
  // AUTH FUNCTIONS
  // ============================================

  async function validateToken(apiUrl, token) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  function showAuthSection() {
    authSection.classList.remove('hidden');
    mainSection.classList.add('hidden');
  }

  function showMainSection(userName) {
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    userNameSpan.textContent = userName;
  }

  function showAuthMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = type;
    authMessage.classList.remove('hidden');
  }

  // Tab switching
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      if (tab.dataset.tab === 'login') {
        loginForm.classList.remove('hidden');
        codeForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        codeForm.classList.remove('hidden');
      }
      authMessage.classList.add('hidden');
    });
  });

  // Login form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const config = await chrome.storage.sync.get({ jt_apiUrl: 'https://jobscouter-1.preview.emergentagent.com' });
    
    try {
      showAuthMessage('Connexion en cours...', 'info');
      
      const response = await fetch(`${config.jt_apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Identifiants incorrects');
      }
      
      const data = await response.json();
      
      // Get user info
      const meResponse = await fetch(`${config.jt_apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await meResponse.json();
      
      // Save to storage
      await chrome.storage.sync.set({
        jt_token: data.access_token,
        jt_userEmail: userData.email,
        jt_userName: userData.full_name
      });
      
      showAuthMessage('Connexion réussie !', 'success');
      setTimeout(() => {
        showMainSection(userData.full_name || userData.email);
      }, 500);
      
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });

  // Code form submission
  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const code = document.getElementById('authCode').value.toUpperCase();
    
    if (code.length < 6) {
      showAuthMessage('Le code doit contenir au moins 6 caractères', 'error');
      return;
    }
    
    const config = await chrome.storage.sync.get({ jt_apiUrl: 'https://jobscouter-1.preview.emergentagent.com' });
    
    try {
      showAuthMessage('Vérification du code...', 'info');
      
      const response = await fetch(`${config.jt_apiUrl}/api/auth/extension/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Code invalide');
      }
      
      const data = await response.json();
      
      // Get user info
      const meResponse = await fetch(`${config.jt_apiUrl}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      const userData = await meResponse.json();
      
      // Save to storage
      await chrome.storage.sync.set({
        jt_token: data.access_token,
        jt_userEmail: userData.email,
        jt_userName: userData.full_name
      });
      
      showAuthMessage('Extension connectée !', 'success');
      setTimeout(() => {
        showMainSection(userData.full_name || userData.email);
      }, 500);
      
    } catch (error) {
      showAuthMessage(error.message, 'error');
    }
  });

  // Logout
  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.sync.remove(['jt_token', 'jt_userEmail', 'jt_userName']);
    showAuthSection();
    authMessage.classList.add('hidden');
  });

  // ============================================
  // MAIN FUNCTIONALITY
  // ============================================

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
        jt_apiUrl: 'https://jobscouter-1.preview.emergentagent.com',
        jt_token: ''
      });

      if (!config.jt_token) {
        showMessage("Erreur: Non connecté. Veuillez vous connecter.", "error");
        showAuthSection();
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
        if (response.status === 401 || response.status === 403) {
          await chrome.storage.sync.remove(['jt_token', 'jt_userEmail', 'jt_userName']);
          showMessage("Session expirée. Veuillez vous reconnecter.", "error");
          showAuthSection();
          return;
        }
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
      if (data.salary_max) salaryMaxInput.value = data.salary_max;
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
      jt_apiUrl: 'https://jobscouter-1.preview.emergentagent.com',
      jt_token: ''
    });

    if (!config.jt_token) {
      showMessage("Erreur: Non connecté. Veuillez vous connecter.", "error");
      showAuthSection();
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
        if (response.status === 401 || response.status === 403) {
          await chrome.storage.sync.remove(['jt_token', 'jt_userEmail', 'jt_userName']);
          showMessage("Session expirée. Veuillez vous reconnecter.", "error");
          showAuthSection();
          return;
        }
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      
      showMessage("✓ Candidature ajoutée avec succès !", "success");
      
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

  // Options link
  document.getElementById('optionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
