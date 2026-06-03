chrome.action.getBadgeText({}, (text) => {
  document.getElementById('count').textContent = text || '0';
});
