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
  const modeBtns = document.querySelectorAll('.mode-btn');
  
  // Mode switching
  // Mode switching
  let currentMode = 'ai';
  
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update UI
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentMode = btn.dataset.mode;
      
      if (currentMode === 'manual') {
        extractBtn.classList.add('hidden');
      } else {
        extractBtn.classList.remove('hidden');
        if (currentMode === 'ai') {
          extractBtn.innerHTML = 'Extraire avec IA ✨';
        } else {
          extractBtn.innerHTML = 'Scraper la page 🕷️';
        }
      }
    });
  });
  
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
    
    const config = await chrome.storage.sync.get({ jt_apiUrl: 'https://touch-nav-drawer.preview.emergentagent.com' });
    
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
    
    const config = await chrome.storage.sync.get({ jt_apiUrl: 'https://touch-nav-drawer.preview.emergentagent.com' });
    
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

  // Known API URLs already covered by manifest host_permissions
  const KNOWN_API_HOSTS = ['job-tracker-steel-eight.vercel.app'];

  // Request optional <all_urls> permission if the API URL is not a known host
  async function ensureApiPermission(apiUrl) {
    try {
      const host = new URL(apiUrl).hostname;
      if (KNOWN_API_HOSTS.some(h => host.endsWith(h))) return true;
      // Custom URL: request optional permission
      return await chrome.permissions.request({ origins: [`${new URL(apiUrl).origin}/*`] });
    } catch {
      return false;
    }
  }

  // Retry helper: retries a fetch on network errors (not on HTTP errors)
  async function fetchWithRetry(url, options, maxRetries = 2, delayMs = 1000) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fetch(url, options);
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          loadingDiv.textContent = `Erreur réseau, nouvelle tentative (${attempt + 1}/${maxRetries})...`;
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }
    throw lastError;
  }

  // AI/Scraping Extraction button
  extractBtn.addEventListener('click', async () => {
    loadingDiv.classList.remove('hidden');
    extractBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

      // ============================================
      // MODE: SCRAPING
      // ============================================
      if (currentMode === 'scraping') {
        loadingDiv.textContent = 'Scraping de la page...';
        
        // Send message to content script
        try {
          // Attempt 1: Send message directly
          let response = await chrome.tabs.sendMessage(tab.id, {action: "scrape"}).catch(() => null);
          
          // Attempt 2: Inject script if message failed (probably not a supported site in manifest)
          if (!response) {
             loadingDiv.textContent = 'Injection du script (Universel)...';
             console.log("Injecting content script dynamically...");
             await chrome.scripting.executeScript({
               target: { tabId: tab.id },
               files: ['content.js']
             });
             // Wait a bit for script to initialize
             await new Promise(r => setTimeout(r, 200));
             // Retry message
             response = await chrome.tabs.sendMessage(tab.id, {action: "scrape"});
          }
          
          if (response) {
            if (response.title) titleInput.value = response.title;
            if (response.company) companyInput.value = response.company;
            if (response.location) locationInput.value = response.location;
            if (response.description) {
              const raw = response.description;
              if (raw.length > 500) {
                const cut = raw.lastIndexOf(' ', 500);
                descriptionInput.value = raw.substring(0, cut > 0 ? cut : 500) + '…';
              } else {
                descriptionInput.value = raw;
              }
            }
            
            // Try to guess URL type if not already set
            if (!typeSelect.value && response.description) {
               const desc = response.description.toLowerCase();
               if (desc.includes('stage') || desc.includes('internship')) typeSelect.value = 'stage';
               else if (desc.includes('alternance') || desc.includes('apprenticeship')) typeSelect.value = 'alternance';
               else if (desc.includes('freelance') || desc.includes('indépendant')) typeSelect.value = 'freelance';
               else if (desc.includes('cdd')) typeSelect.value = 'cdd';
               else typeSelect.value = 'cdi';
            }

            showMessage("Scraping terminé !", "success");
          } else {
            throw new Error("Aucune donnée trouvée");
          }
        } catch (e) {
          console.error("Scraping error:", e);
          showMessage("Impossible de scraper cette page. Vérifiez que vous êtes sur un site supporté (LinkedIn, Indeed, etc.) ou rechargez la page.", "error");
        }
        return;
      }

      // ============================================
      // MODE: AI
      // ============================================
      loadingDiv.textContent = 'Extraction IA en cours...';

      // Get page content from content script
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
        jt_apiUrl: 'https://touch-nav-drawer.preview.emergentagent.com',
        jt_token: ''
      });

      if (!config.jt_token) {
        showMessage("Erreur: Non connecté. Veuillez vous connecter.", "error");
        showAuthSection();
        return;
      }

      // Ensure permission for custom API URL if needed
      const hasPermission = await ensureApiPermission(config.jt_apiUrl);
      if (!hasPermission) {
        showMessage("Permission refusée pour l'URL de l'API. Vérifiez la configuration.", "error");
        return;
      }

      // Call AI extraction endpoint
      loadingDiv.textContent = 'Extraction IA en cours...';
      const response = await fetchWithRetry(`${config.jt_apiUrl}/api/ai/extract-job`, {
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
      jt_apiUrl: 'https://touch-nav-drawer.preview.emergentagent.com',
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

      await ensureApiPermission(config.jt_apiUrl);
      const response = await fetchWithRetry(`${config.jt_apiUrl}/api/applications`, {
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
    const u = url.toLowerCase();
    if (u.includes('linkedin')) return 'linkedin';
    if (u.includes('indeed')) return 'indeed';
    if (u.includes('welcometothejungle')) return 'welcome_to_jungle';
    if (u.includes('apec')) return 'apec';
    if (u.includes('pole-emploi') || u.includes('francetravail')) return 'pole_emploi';
    if (u.includes('glassdoor')) return 'glassdoor';
    if (u.includes('monster')) return 'monster';
    if (u.includes('cadremploi')) return 'cadremploi';
    if (u.includes('hellowork')) return 'hellowork';
    if (u.includes('jobteaser')) return 'jobteaser';
    if (u.includes('meteojob')) return 'meteojob';
    if (u.includes('lever.co')) return 'lever';
    if (u.includes('greenhouse.io')) return 'greenhouse';
    if (u.includes('workday')) return 'workday';
    if (u.includes('smartrecruiters')) return 'smartrecruiters';
    if (u.includes('welcomekit')) return 'welcomekit';
    if (u.includes('regionsjob')) return 'regionsjob';
    if (u.includes('keljob')) return 'keljob';
    if (u.includes('manpower')) return 'manpower';
    if (u.includes('adecco')) return 'adecco';
    if (u.includes('randstad')) return 'randstad';
    if (u.includes('michaelpage')) return 'michaelpage';
    if (u.includes('hays')) return 'hays';
    if (u.includes('talent.io')) return 'talent_io';
    if (u.includes('malt.fr')) return 'malt';
    if (u.includes('comet.co')) return 'comet';
    if (u.includes('wizbii')) return 'wizbii';
    if (u.includes('wellfound') || u.includes('angel.co')) return 'wellfound';
    if (u.includes('ycombinator')) return 'ycombinator';
    if (u.includes('weworkremotely')) return 'weworkremotely';
    if (u.includes('remoteok')) return 'remoteok';
    if (u.includes('stepstone')) return 'stepstone';
    if (u.includes('xing.com')) return 'xing';
    if (u.includes('jooble')) return 'jooble';
    if (u.includes('jobijoba')) return 'jobijoba';
    if (u.includes('meteojob')) return 'meteojob';
    if (u.includes('jobrapido')) return 'jobrapido';
    if (u.includes('ashbyhq')) return 'ashby';
    if (u.includes('workable')) return 'workable';
    if (u.includes('bamboohr')) return 'bamboohr';
    if (u.includes('jobvite')) return 'jobvite';
    if (u.includes('taleo')) return 'taleo';
    if (u.includes('icims')) return 'icims';
    if (u.includes('breezy')) return 'breezy';
    if (u.includes('recruitee')) return 'recruitee';
    if (u.includes('rekrute')) return 'rekrute';
    if (u.includes('fonction-publique.gouv')) return 'fonction_publique';
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
