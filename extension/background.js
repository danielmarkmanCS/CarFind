let totalSent = 0;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'NEW_LISTINGS') {
    totalSent += msg.count;
    chrome.action.setBadgeText({ text: String(totalSent) });
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
  }
});
