/**
 * Content script: scans the page for Dutch postal codes (1234 AB),
 * injects a McDonald's icon after each match and shows a tooltip with
 * the distance to (and address of) the nearest McDonald's.
 */
(() => {
  const ICON_CLASS = 'mcd-pc-icon';
  const TOOLTIP_ID = 'mcd-pc-tooltip';
  // Dutch postal code: 4 digits (no leading zero) + 2 capital letters.
  // The combinations SA, SD and SS are never issued.
  const POSTCODE_RE = /\b([1-9][0-9]{3}) ?([A-Z]{2})\b/g;
  const EXCLUDED_LETTERS = new Set(['SA', 'SD', 'SS']);
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT',
    'SELECT', 'OPTION', 'IFRAME', 'CANVAS', 'SVG',
  ]);

  let enabled = false;
  let observer = null;
  let pendingNodes = new Set();
  let scanTimer = null;

  let tooltip = null;
  let tooltipFor = null; // icon the tooltip currently belongs to
  let pinned = false;
  let hideTimer = null;

  chrome.storage.local.get({ enabled: true }, (items) => {
    if (items.enabled) start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.enabled) return;
    if (changes.enabled.newValue) start();
    else stop();
  });

  function start() {
    if (enabled) return;
    enabled = true;
    scan(document.body || document.documentElement);
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stop() {
    enabled = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    pendingNodes.clear();
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    document.querySelectorAll('.' + ICON_CLASS).forEach((el) => el.remove());
    hideTooltip(true);
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  function onMutations(mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.classList && node.classList.contains(ICON_CLASS)) continue;
          if (node.id === TOOLTIP_ID) continue;
          pendingNodes.add(node);
        } else if (node.nodeType === Node.TEXT_NODE) {
          pendingNodes.add(node);
        }
      }
    }
    if (pendingNodes.size && !scanTimer) {
      scanTimer = setTimeout(() => {
        scanTimer = null;
        const nodes = [...pendingNodes];
        pendingNodes.clear();
        for (const node of nodes) {
          if (!node.isConnected) continue;
          if (node.nodeType === Node.TEXT_NODE) processTextNode(node);
          else scan(node);
        }
      }, 250);
    }
  }

  function shouldSkip(element) {
    for (let el = element; el; el = el.parentElement) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.classList.contains(ICON_CLASS) || el.id === TOOLTIP_ID) return true;
      if (el.isContentEditable) return true;
    }
    return false;
  }

  function scan(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data || node.data.length < 6) return NodeFilter.FILTER_REJECT;
        if (!node.parentElement || shouldSkip(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    // Collect first: processing splits text nodes, which confuses the walker.
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(processTextNode);
  }

  function processTextNode(node) {
    if (!enabled || !node.isConnected) return;
    const text = node.data;
    POSTCODE_RE.lastIndex = 0;
    let match;
    while ((match = POSTCODE_RE.exec(text))) {
      if (EXCLUDED_LETTERS.has(match[2])) continue;
      const end = match.index + match[0].length;
      // Already processed: a previous pass split this node right after the
      // postcode and placed an icon as the next sibling.
      if (end === text.length && isIcon(node.nextSibling)) return;
      const postcode = `${match[1]} ${match[2]}`;
      const rest = node.splitText(end);
      node.parentNode.insertBefore(createIcon(postcode), rest);
      processTextNode(rest);
      return;
    }
  }

  function isIcon(node) {
    return !!(
      node &&
      node.nodeType === Node.ELEMENT_NODE &&
      node.classList.contains(ICON_CLASS)
    );
  }

  function createIcon(postcode) {
    const icon = document.createElement('span');
    icon.className = ICON_CLASS;
    icon.dataset.postcode = postcode;
    icon.tabIndex = 0;
    icon.setAttribute('role', 'button');
    icon.setAttribute(
      'aria-label',
      `Afstand tot dichtstbijzijnde McDonald's vanaf ${postcode}`
    );
    icon.addEventListener('mouseenter', () => showTooltip(icon));
    icon.addEventListener('mouseleave', () => scheduleHide());
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pinned && tooltipFor === icon) {
        pinned = false;
        hideTooltip(true);
      } else {
        showTooltip(icon);
        pinned = true;
      }
    });
    return icon;
  }

  function ensureTooltip() {
    if (tooltip && tooltip.isConnected) return tooltip;
    tooltip = document.createElement('div');
    tooltip.id = TOOLTIP_ID;
    tooltip.addEventListener('mouseenter', () => {
      if (hideTimer) clearTimeout(hideTimer);
    });
    tooltip.addEventListener('mouseleave', () => scheduleHide());
    document.documentElement.appendChild(tooltip);
    document.addEventListener('click', (e) => {
      if (pinned && tooltip && !tooltip.contains(e.target) && !isIcon(e.target)) {
        pinned = false;
        hideTooltip(true);
      }
    });
    return tooltip;
  }

  function showTooltip(icon) {
    if (!enabled) return;
    if (hideTimer) clearTimeout(hideTimer);
    const tip = ensureTooltip();
    tooltipFor = icon;
    pinned = false;
    renderLoading(tip, icon.dataset.postcode);
    position(tip, icon);
    tip.style.display = 'block';

    chrome.runtime.sendMessage(
      { type: 'mcd-lookup', postcode: icon.dataset.postcode },
      (response) => {
        if (tooltipFor !== icon || !tooltip) return;
        if (chrome.runtime.lastError || !response) {
          renderError(tip, 'Opzoeken mislukt. Probeer het later opnieuw.');
        } else if (response.error) {
          renderError(tip, response.error);
        } else {
          renderResult(tip, icon.dataset.postcode, response);
        }
        position(tip, icon);
      }
    );
  }

  function scheduleHide() {
    if (pinned) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => hideTooltip(false), 250);
  }

  function hideTooltip(force) {
    if (pinned && !force) return;
    if (tooltip) tooltip.style.display = 'none';
    tooltipFor = null;
  }

  function position(tip, icon) {
    const rect = icon.getBoundingClientRect();
    const top = rect.bottom + window.scrollY + 6;
    let left = rect.left + window.scrollX;
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
    // Keep the tooltip inside the viewport horizontally.
    const tipRect = tip.getBoundingClientRect();
    const overflow = tipRect.right - (window.scrollX + document.documentElement.clientWidth) + 8;
    if (overflow > 0) {
      left = Math.max(window.scrollX + 8, left - overflow);
      tip.style.left = `${left}px`;
    }
  }

  function renderLoading(tip, postcode) {
    tip.replaceChildren(
      el('div', 'mcd-pc-tooltip-title', `Postcode ${postcode}`),
      el('div', 'mcd-pc-tooltip-loading', 'Dichtstbijzijnde McDonald’s zoeken…')
    );
  }

  function renderError(tip, message) {
    tip.replaceChildren(el('div', 'mcd-pc-tooltip-error', message));
  }

  function renderResult(tip, postcode, data) {
    const km = data.distanceKm;
    const distanceText =
      km < 1
        ? `${Math.round(km * 1000)} m`
        : `${km.toFixed(1).replace('.', ',')} km`;
    tip.replaceChildren(
      el('div', 'mcd-pc-tooltip-title', `Postcode ${postcode}`),
      el('div', 'mcd-pc-tooltip-distance', `🍔 ${distanceText} naar de dichtstbijzijnde McDonald’s`),
      el('div', 'mcd-pc-tooltip-address', data.address || 'Adres onbekend')
    );
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
})();
