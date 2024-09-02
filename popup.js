document.getElementById('get-urls').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = new URL(tab.url).hostname;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: extractURLs,
    args: [domain]
  });
});

function extractURLs(domain) {
  var scripts = document.getElementsByTagName("script"),
      regex = /(?<=("|'|`))(?:(?:https?:)?\/\/[^/'"]+)?\/[a-zA-Z0-9_\-./]+(?:\?[^"'`]*)?(?=("|'|`))/g;
  const results = new Set();
  
  function isValidURL(url) {
    const jsPatterns = [
      '+', '=', '(', ')', '{', '}', 'function', 'var', 'let', 'const', 'window', 'document',
      '.concat', '.slice', '.indexOf', 'try', 'catch', 'return'
    ];
    return !jsPatterns.some(pattern => url.includes(pattern)) && url.length > 1;
  }

  for (var i = 0; i < scripts.length; i++) {
    var t = scripts[i].src;
    if (t !== "") {
      fetch(t).then(function(t){ return t.text() })
        .then(function(t){
          var e = t.matchAll(regex);
          for (let r of e) {
            if (isValidURL(r[0])) results.add(r[0]);
          }
        })
        .catch(function(t){ console.log("An error occurred: ", t) });
    }
  }
  
  var pageContent = document.documentElement.outerHTML,
      matches = pageContent.matchAll(regex);
  for (const match of matches) {
    if (isValidURL(match[0])) results.add(match[0]);
  }
  
  setTimeout(() => {
    chrome.runtime.sendMessage({ domain, urls: Array.from(results) });
  }, 3000);
}

function isValidJSON(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

// Update the UI when a message is received
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { domain, urls } = message;
  let storedURLs = localStorage.getItem('storedURLs');
  
  storedURLs = storedURLs && isValidJSON(storedURLs) ? JSON.parse(storedURLs) : {};
  
  // Merge new URLs with existing ones
  if (!storedURLs[domain]) {
    storedURLs[domain] = new Set();
  } else {
    storedURLs[domain] = new Set(storedURLs[domain]);
  }
  
  urls.forEach(url => storedURLs[domain].add(url));
  
  // Convert the URLs to clickable links
  const clickableURLs = Array.from(storedURLs[domain]).map(url => {
    if (url.startsWith('//')) {
      const displayUrl = url.substring(2); // Remove '//' from display
      return `<a href="https:${url}" target="_blank">${displayUrl}</a>`;
    } else if (url.startsWith('/')) {
      return `<a href="https://${domain}${url}" target="_blank">${domain}${url}</a>`;
    } else {
      return `<a href="${url}" target="_blank">${url}</a>`;
    }
  }).join('<br>');
  
  storedURLs[domain] = Array.from(storedURLs[domain]); // Convert Set back to Array for storage
  localStorage.setItem('storedURLs', JSON.stringify(storedURLs));
  document.getElementById('output').innerHTML = clickableURLs;
});

// Load stored URLs for the current domain when the pop-up opens
document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = new URL(tab.url).hostname;
  let storedURLs = localStorage.getItem('storedURLs');
  
  storedURLs = storedURLs && isValidJSON(storedURLs) ? JSON.parse(storedURLs) : {};
  if (storedURLs[domain]) {
    const clickableURLs = storedURLs[domain].map(url => {
      if (url.startsWith('//')) {
        const displayUrl = url.substring(2); // Remove '//' from display
        return `<a href="https:${url}" target="_blank">${displayUrl}</a>`;
      } else if (url.startsWith('/')) {
        return `<a href="https://${domain}${url}" target="_blank">${domain}${url}</a>`;
      } else {
        return `<a href="${url}" target="_blank">${url}</a>`;
      }
    }).join('<br>');
    document.getElementById('output').innerHTML = clickableURLs;
  } else {
    document.getElementById('output').innerHTML = "No URLs found for this domain.";
  }
});

// Copy URLs to clipboard when the copy button is clicked
document.getElementById('copy-button').addEventListener('click', () => {
  const outputDiv = document.getElementById('output');
  const textToCopy = outputDiv.innerText;
  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("URLs copied to clipboard!");
  }).catch(err => {
    console.error("Failed to copy: ", err);
  });
});