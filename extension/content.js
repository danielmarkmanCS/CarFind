const API = 'https://carfind-backend.onrender.com';
const SEEN_KEY = 'carfind_seen';
console.log('[CarFind] extension loaded on', window.location.href);

const CATEGORY_MAP: Record<string, string> = {
  '/vehicles': 'vehicles',
  '/cars': 'vehicles',
  '/property-rentals': 'real-estate',
  '/property-for-sale': 'real-estate',
  '/electronics': 'products',
  '/furniture': 'products',
  '/classifieds': 'products',
  '/jobs': 'jobs',
  '/pets': 'pets',
  '/animals': 'pets',
};

function detectCategory(): string | null {
  const path = window.location.pathname;
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (path.includes(key)) return cat;
  }
  // אל תאסוף מדפי homepage או mixed
  return null;
}

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

function parseLink(link) {
  const href = link.href;
  const external_id = href.match(/\/item\/(\d+)/)?.[1];
  if (!external_id) return null;

  // walk up to find a container with meaningful content (~5 levels)
  let container = link;
  for (let i = 0; i < 6; i++) {
    if (container.parentElement) container = container.parentElement;
    const texts = Array.from(container.querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
    if (texts.length >= 2) break;
  }

  const spans = Array.from(container.querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
  const img = container.querySelector('img')?.src || link.querySelector('img')?.src;
  const allText = spans.join(' ');

  const priceText = spans.find(t => t.match(/[\d,]{3,}/));
  const title = spans.find(t => t.length > 5 && !t.match(/^[\d,₪$\s]+$/) && !t.match(/^[0-9,. ]+$/));

  return {
    source: 'marketplace',
    external_id,
    title: title || null,
    price: extractPrice(priceText),
    year: extractYear(allText),
    km: extractKm(allText),
    car_make: null,
    car_model: null,
    seller_type: 'private',
    phone: null,
    city: null,
    images: img ? [img] : [],
    url: `https://www.facebook.com/marketplace/item/${external_id}/`,
    category,
  };
}

async function sendToCarFind(listings) {
  try {
    const res = await fetch(`${API}/listings/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings }),
    });
    const data = await res.json();
    console.log(`[CarFind] backend response:`, data);
  } catch (e) {
    console.log('[CarFind] fetch error:', e.message);
  }
}

async function scan() {
  const category = detectCategory();
  if (!category) {
    console.log('[CarFind] דף כללי — לא אוסף. גלוש לדף קטגוריה ספציפית (vehicles, property וכו\')');
    return;
  }
  console.log(`[CarFind] category: ${category}`);
  const seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
  console.log(`[CarFind] found ${links.length} marketplace links`);

  const newListings = [];
  links.forEach(link => {
    const parsed = parseLink(link);
    if (!parsed || seen.includes(parsed.external_id)) return;
    seen.push(parsed.external_id);
    newListings.push(parsed);
  });

  console.log(`[CarFind] new listings to send: ${newListings.length}`);

  if (newListings.length) {
    await sendToCarFind(newListings);
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-500)));
    chrome.runtime.sendMessage({ type: 'NEW_LISTINGS', count: newListings.length });
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
