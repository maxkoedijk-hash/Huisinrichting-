const toggle = document.getElementById('toggle');
const clearButton = document.getElementById('clear-cache');
const status = document.getElementById('status');

chrome.storage.local.get({ enabled: true }, (items) => {
  toggle.checked = items.enabled;
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

clearButton.addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(all).filter((key) => key.startsWith('mcd:'));
  await chrome.storage.local.remove(cacheKeys);
  status.textContent = `${cacheKeys.length} postcode(s) uit de cache verwijderd.`;
});
