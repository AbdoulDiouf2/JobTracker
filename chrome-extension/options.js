// Sauvegarde les options
document.getElementById('save').addEventListener('click', () => {
    const apiUrl = document.getElementById('apiUrl').value;
    const token = document.getElementById('token').value;
  
    chrome.storage.sync.set({
      jt_apiUrl: apiUrl,
      jt_token: token
    }, () => {
      // Update status to let user know options were saved.
      const status = document.getElementById('status');
      status.style.display = 'block';
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    });
  });
  
  // Restaure les options au chargement
  document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get({
      jt_apiUrl: 'http://localhost:5000',
      jt_token: ''
    }, (items) => {
      document.getElementById('apiUrl').value = items.jt_apiUrl;
      document.getElementById('token').value = items.jt_token;
    });
  });
