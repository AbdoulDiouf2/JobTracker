const DEFAULT_API_URL = "https://job-tracker-steel-eight.vercel.app";
const KNOWN_API_HOSTS = ["job-tracker-steel-eight.vercel.app"];

document.addEventListener("DOMContentLoaded", async () => {
  const authSection = document.getElementById("authSection");
  const mainSection = document.getElementById("mainSection");
  const loginForm = document.getElementById("loginForm");
  const codeForm = document.getElementById("codeForm");
  const authTabs = document.querySelectorAll(".auth-tab");
  const authMessage = document.getElementById("authMessage");
  const logoutBtn = document.getElementById("logoutBtn");
  const userNameSpan = document.getElementById("userName");
  const form = document.getElementById("jobForm");
  const messageDiv = document.getElementById("message");
  const extractBtn = document.getElementById("extractBtn");
  const loadingDiv = document.getElementById("loading");
  const modeBtns = document.querySelectorAll(".mode-btn");
  const titleInput = document.getElementById("title");
  const companyInput = document.getElementById("company");
  const locationInput = document.getElementById("location");
  const urlInput = document.getElementById("url");
  const typeSelect = document.getElementById("type");
  const salaryMinInput = document.getElementById("salaryMin");
  const salaryMaxInput = document.getElementById("salaryMax");
  const descriptionInput = document.getElementById("description");
  const competencesInput = document.getElementById("competences");
  const experienceInput = document.getElementById("experience");
  let currentMode = "ai";

  await migrateAuthFromSyncStorage();
  const config = await getConfig();

  if (config.token && await validateToken(config.apiUrl, config.token)) {
    showMainSection(config.userName || config.userEmail || "Utilisateur");
  } else {
    if (config.token) await clearAuth();
    showAuthSection();
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (tab?.url) urlInput.value = tab.url;
  });

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeBtns.forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      extractBtn.classList.toggle("hidden", currentMode === "manual");
      extractBtn.textContent = currentMode === "scraping" ? "Scraper la page" : "Extraire avec IA";
    });
  });

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      authTabs.forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      loginForm.classList.toggle("hidden", !isLogin);
      codeForm.classList.toggle("hidden", isLogin);
      authMessage.classList.add("hidden");
    });
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const { apiUrl } = await getConfig();

    try {
      showAuthMessage("Connexion en cours...", "info");
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const error = await safeJson(response);
        throw new Error(error.detail || "Identifiants incorrects");
      }
      const data = await response.json();
      const userData = await fetchCurrentUser(apiUrl, data.access_token);
      await saveAuth(data.access_token, userData);
      showAuthMessage("Connexion reussie.", "success");
      setTimeout(() => showMainSection(userData.full_name || userData.email), 500);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  codeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = document.getElementById("authCode").value.trim().toUpperCase();
    const { apiUrl } = await getConfig();
    if (code.length < 6) {
      showAuthMessage("Le code doit contenir au moins 6 caracteres.", "error");
      return;
    }

    try {
      showAuthMessage("Verification du code...", "info");
      const response = await fetch(`${apiUrl}/api/auth/extension/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      if (!response.ok) {
        const error = await safeJson(response);
        throw new Error(error.detail || "Code invalide");
      }
      const data = await response.json();
      const userData = await fetchCurrentUser(apiUrl, data.access_token);
      await saveAuth(data.access_token, userData);
      showAuthMessage("Extension connectee.", "success");
      setTimeout(() => showMainSection(userData.full_name || userData.email), 500);
    } catch (error) {
      showAuthMessage(error.message, "error");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    await clearAuth();
    showAuthSection();
    authMessage.classList.add("hidden");
  });

  extractBtn.addEventListener("click", async () => {
    loadingDiv.classList.remove("hidden");
    extractBtn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabUrl = tab?.url || urlInput.value;
      if (!tab?.id || !isWebPageUrl(tabUrl)) {
        throw new Error("Ouvrez une page web d'offre d'emploi avant l'extraction.");
      }
      urlInput.value = tabUrl;
      if (currentMode === "scraping") await runScrapingExtraction(tab, tabUrl);
      else await runAiExtraction(tab, tabUrl);
    } catch (error) {
      console.error("Extraction error:", error);
      showMessage(`Erreur: ${error.message}`, "error");
    } finally {
      loadingDiv.classList.add("hidden");
      extractBtn.disabled = false;
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = {
      poste: titleInput.value.trim(),
      entreprise: companyInput.value.trim(),
      lieu: locationInput.value.trim() || null,
      lien: urlInput.value,
      type_poste: typeSelect.value,
      salaire_min: salaryMinInput.value ? parseInt(salaryMinInput.value, 10) : null,
      salaire_max: salaryMaxInput.value ? parseInt(salaryMaxInput.value, 10) : null,
      description_poste: descriptionInput.value.trim() || null,
      competences: competencesInput.value ? competencesInput.value.split(",").map((item) => item.trim()).filter(Boolean) : [],
      experience_requise: experienceInput.value.trim() || null,
      date_candidature: new Date().toISOString(),
      reponse: "pending",
      moyen: detectApplicationMethod(urlInput.value),
      is_favorite: false
    };
    if (!formData.entreprise || !formData.poste) {
      showMessage("Entreprise et poste sont requis.", "error");
      return;
    }

    const { apiUrl, token } = await getConfig();
    if (!token) {
      showMessage("Vous devez vous connecter.", "error");
      showAuthSection();
      return;
    }

    try {
      loadingDiv.classList.remove("hidden");
      loadingDiv.textContent = "Enregistrement...";
      if (!await ensureApiPermission(apiUrl)) throw new Error("Permission refusee pour l'URL de l'API.");
      const response = await fetchWithRetry(`${apiUrl}/api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!response.ok) await handleApiFailure(response);
      showMessage("Candidature ajoutee avec succes.", "success");
      setTimeout(() => window.close(), 1200);
    } catch (error) {
      console.error("Save error:", error);
      showMessage(`Erreur: ${error.message}`, "error");
    } finally {
      loadingDiv.classList.add("hidden");
    }
  });

  document.getElementById("optionsLink").addEventListener("click", (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  async function runScrapingExtraction(tab, tabUrl) {
    loadingDiv.textContent = "Scraping de la page...";
    let response = await chrome.tabs.sendMessage(tab.id, { action: "scrape" }).catch(() => null);
    if (!response) {
      loadingDiv.textContent = "Preparation du scraper...";
      if (!await ensurePagePermission(tabUrl)) throw new Error("Permission refusee pour lire cette page.");
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await new Promise((resolve) => setTimeout(resolve, 150));
      response = await chrome.tabs.sendMessage(tab.id, { action: "scrape" });
    }
    if (!response) throw new Error("Aucune donnee exploitable trouvee.");
    if (response.title) titleInput.value = response.title;
    if (response.company) companyInput.value = response.company;
    if (response.location) locationInput.value = response.location;
    if (response.description) descriptionInput.value = trimAtWord(response.description, 500);
    guessContractType(response.description || "");
    showMessage("Scraping termine.", "success");
  }

  async function runAiExtraction(tab, tabUrl) {
    const { apiUrl, token } = await getConfig();
    if (!token) {
      showMessage("Vous devez vous connecter.", "error");
      showAuthSection();
      return;
    }
    if (!await ensureApiPermission(apiUrl)) throw new Error("Permission refusee pour l'URL de l'API.");
    loadingDiv.textContent = "Lecture de l'offre...";
    if (!await ensurePagePermission(tabUrl)) throw new Error("Permission refusee pour lire cette page.");
    const pageContent = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectJobPageText });
    const content = pageContent[0]?.result || "";
    if (content.length < 80) throw new Error("Le contenu de cette page est trop court pour l'extraction IA.");

    loadingDiv.textContent = "Extraction IA en cours...";
    const response = await fetchWithRetry(`${apiUrl}/api/ai/extract-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ page_content: content, page_url: tabUrl })
    });
    if (!response.ok) await handleApiFailure(response);
    const data = await response.json();
    if (data.poste) titleInput.value = data.poste;
    if (data.entreprise) companyInput.value = data.entreprise;
    if (data.lieu) locationInput.value = data.lieu;
    if (data.type_poste) typeSelect.value = data.type_poste;
    if (data.salaire_min) salaryMinInput.value = data.salaire_min;
    if (data.salaire_max) salaryMaxInput.value = data.salaire_max;
    if (data.description_poste) descriptionInput.value = data.description_poste;
    if (data.experience_requise) experienceInput.value = data.experience_requise;
    if (data.competences?.length) competencesInput.value = data.competences.join(", ");
    showMessage(`Extraction reussie. Confiance: ${Math.round((data.confidence_score || 0) * 100)}%.`, "success");
  }

  async function getConfig() {
    const [settings, auth] = await Promise.all([
      chrome.storage.sync.get({ jt_apiUrl: DEFAULT_API_URL }),
      chrome.storage.local.get({ jt_token: "", jt_userEmail: "", jt_userName: "" })
    ]);
    return {
      apiUrl: normalizeApiUrl(settings.jt_apiUrl || DEFAULT_API_URL),
      token: auth.jt_token,
      userEmail: auth.jt_userEmail,
      userName: auth.jt_userName
    };
  }

  async function migrateAuthFromSyncStorage() {
    const oldAuth = await chrome.storage.sync.get({ jt_token: "", jt_userEmail: "", jt_userName: "" });
    if (!oldAuth.jt_token) return;
    await chrome.storage.local.set(oldAuth);
    await chrome.storage.sync.remove(["jt_token", "jt_userEmail", "jt_userName"]);
  }

  async function saveAuth(token, userData) {
    await chrome.storage.local.set({ jt_token: token, jt_userEmail: userData.email, jt_userName: userData.full_name });
  }

  async function clearAuth() {
    await Promise.all([
      chrome.storage.local.remove(["jt_token", "jt_userEmail", "jt_userName"]),
      chrome.storage.sync.remove(["jt_token", "jt_userEmail", "jt_userName"])
    ]);
  }

  async function validateToken(apiUrl, token) {
    try {
      const response = await fetch(`${apiUrl}/api/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
      return response.ok;
    } catch {
      return false;
    }
  }

  async function fetchCurrentUser(apiUrl, token) {
    const response = await fetch(`${apiUrl}/api/auth/me`, { headers: { "Authorization": `Bearer ${token}` } });
    if (!response.ok) throw new Error("Impossible de recuperer le profil utilisateur.");
    return response.json();
  }

  async function ensureApiPermission(apiUrl) {
    try {
      const { origin, hostname } = new URL(apiUrl);
      if (KNOWN_API_HOSTS.some((host) => hostname.endsWith(host))) return true;
      return await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      return false;
    }
  }

  async function ensurePagePermission(pageUrl) {
    try {
      const { origin } = new URL(pageUrl);
      if (await chrome.permissions.contains({ origins: [`${origin}/*`] })) return true;
      return await chrome.permissions.request({ origins: [`${origin}/*`] });
    } catch {
      return false;
    }
  }

  async function fetchWithRetry(url, options, maxRetries = 2, delayMs = 900) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await fetch(url, options);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          loadingDiv.textContent = `Erreur reseau, nouvelle tentative ${attempt + 1}/${maxRetries}...`;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  async function handleApiFailure(response) {
    if (response.status === 401 || response.status === 403) {
      await clearAuth();
      showAuthSection();
      throw new Error("Session expiree. Veuillez vous reconnecter.");
    }
    const error = await safeJson(response);
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  async function safeJson(response) {
    try { return await response.json(); } catch { return {}; }
  }

  function showAuthSection() {
    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }

  function showMainSection(userName) {
    authSection.classList.add("hidden");
    mainSection.classList.remove("hidden");
    userNameSpan.textContent = userName;
  }

  function showAuthMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = type;
    authMessage.classList.remove("hidden");
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
  }

  function guessContractType(description) {
    const desc = description.toLowerCase();
    if (desc.includes("stage") || desc.includes("internship")) typeSelect.value = "stage";
    else if (desc.includes("alternance") || desc.includes("apprenticeship")) typeSelect.value = "alternance";
    else if (desc.includes("freelance") || desc.includes("independant")) typeSelect.value = "freelance";
    else if (desc.includes("cdd")) typeSelect.value = "cdd";
    else typeSelect.value = "cdi";
  }
});

function normalizeApiUrl(value) {
  return String(value || DEFAULT_API_URL).trim().replace(/\/+$/, "");
}

function isWebPageUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function trimAtWord(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const cut = text.lastIndexOf(" ", maxLength);
  return `${text.substring(0, cut > 0 ? cut : maxLength)}...`;
}

function detectApplicationMethod(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("linkedin")) return "linkedin";
  if (u.includes("indeed")) return "indeed";
  if (u.includes("welcometothejungle")) return "welcome_to_jungle";
  if (u.includes("apec")) return "apec";
  if (u.includes("pole-emploi") || u.includes("francetravail")) return "pole_emploi";
  if (u.includes("lever.co") || u.includes("greenhouse.io") || u.includes("workday") || u.includes("smartrecruiters") || u.includes("ashbyhq") || u.includes("workable") || u.includes("bamboohr") || u.includes("jobvite") || u.includes("taleo") || u.includes("icims") || u.includes("recruitee")) return "company_website";
  return "other";
}

function collectJobPageText() {
  const selectors = ["script[type='application/ld+json']", "[data-testid*='job']", "[class*='job']", "[id*='job']", "main", "article", "[role='main']"];
  const chunks = [];
  const title = document.querySelector("h1")?.innerText || document.title || "";
  const metaDescription = document.querySelector("meta[name='description']")?.content || document.querySelector("meta[property='og:description']")?.content || "";
  if (title) chunks.push(`Title: ${title}`);
  if (metaDescription) chunks.push(`Meta: ${metaDescription}`);
  document.querySelectorAll(selectors.join(",")).forEach((node) => {
    chunks.push(node.tagName === "SCRIPT" ? node.textContent || "" : node.innerText || "");
  });
  const cleaned = chunks.join("\n\n").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  if (cleaned.length >= 300) return cleaned.substring(0, 12000);
  const body = document.body.cloneNode(true);
  body.querySelectorAll("script, style, noscript, iframe, nav, footer").forEach((node) => node.remove());
  return body.innerText.replace(/\s+/g, " ").trim().substring(0, 12000);
}
