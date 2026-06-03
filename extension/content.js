const API = 'https://carfind-backend.onrender.com';
const SEEN_KEY = 'carfind_seen';
console.log('[CarFind] extension loaded on', window.location.href);

function extractPrice(text) {
  const m = text?.match(/[\d,]+/);
  return m ? parseInt(m[0].replace(/,/g, '')) : null;
}

function extractYear(text) {
  const m = text?.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

function extractKm(text) {
  const m = text?.match(/([\d,]+)\s*k?m/i);
  return m ? parseInt(m[1].replace(/,/g, '')) * (text.includes('km') && !text.includes('00') ? 1000 : 1) : null;
}

function parseCard(card) {
  // Facebook Marketplace listing card structure
  const link = card.querySelector('a[href*="/marketplace/item/"]');
  if (!link) return null;

  const href = link.href;
  const external_id = href.match(/\/item\/(\d+)/)?.[1];
  if (!external_id) return null;

  const texts = Array.from(card.querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
  const img = card.querySelector('img')?.src;

  // price is usually first or second numeric span
  const priceText = texts.find(t => t.match(/[₪$]?\s*[\d,]+/));
  // title is usually first longer text
  const title = texts.find(t => t.length > 5 && !t.match(/^[\d,₪$]+$/));

  const allText = texts.join(' ');
  const year = extractYear(allText);
  const km = extractKm(allText);

  return {
    source: 'marketplace',
    external_id,
    title: title || null,
    price: extractPrice(priceText),
    year,
    km,
    car_make: null,
    car_model: null,
    seller_type: 'private',
    phone: null,
    city: null,
    images: img ? [img] : [],
    url: href,
  };
}

async function sendToCarFind(listings) {
  try {
    await fetch(`${API}/listings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
  } catch (e) {
    console.log('[CarFind]', e.message);
  }
}

async function scan() {
  const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  const cards = document.querySelectorAll('[data-testid="marketplace_feed_item"], [aria-label*="רכב"], [aria-label*="car"], [href*="/marketplace/item/"]');

  const newListings = [];
  cards.forEach(card => {
    const parsed = parseCard(card.closest('[role="article"]') || card);
    if (!parsed || seen.includes(parsed.external_id)) return;
    seen.push(parsed.external_id);
    newListings.push(parsed);
  });

  if (newListings.length) {
    await sendToCarFind(newListings);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-500)));
    chrome.runtime.sendMessage({ type: 'NEW_LISTINGS', count: newListings.length });
    console.log(`[CarFind] sent ${newListings.length} listings`);
  }
}

// scan on load and on scroll
scan();
let scrollTimer;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(scan, 1500);
});

// watch for new content (infinite scroll)
const observer = new MutationObserver(() => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(scan, 1000);
});
observer.observe(document.body, { childList: true, subtree: true });
