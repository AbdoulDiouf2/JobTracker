const DEFAULT_API_URL = "https://job-tracker-steel-eight.vercel.app";

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrlInput = document.getElementById("apiUrl");
  const tokenInput = document.getElementById("token");
  const saveButton = document.getElementById("save");
  const clearTokenButton = document.getElementById("clearToken");
  const status = document.getElementById("status");

  const [settings, auth] = await Promise.all([
    chrome.storage.sync.get({ jt_apiUrl: DEFAULT_API_URL }),
    chrome.storage.local.get({ jt_token: "" })
  ]);

  apiUrlInput.value = settings.jt_apiUrl || DEFAULT_API_URL;
  tokenInput.value = auth.jt_token || "";

  saveButton.addEventListener("click", async () => {
    const apiUrl = normalizeApiUrl(apiUrlInput.value);
    const token = tokenInput.value.trim();

    await chrome.storage.sync.set({ jt_apiUrl: apiUrl });

    if (token) {
      await chrome.storage.local.set({ jt_token: token });
    }

    showStatus("Options enregistrees.");
  });

  clearTokenButton.addEventListener("click", async () => {
    await chrome.storage.local.remove(["jt_token", "jt_userEmail", "jt_userName"]);
    tokenInput.value = "";
    showStatus("Session locale supprimee.");
  });

  function showStatus(text) {
    status.textContent = text;
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 2200);
  }
});

function normalizeApiUrl(value) {
  return String(value || DEFAULT_API_URL).trim().replace(/\/+$/, "");
}
