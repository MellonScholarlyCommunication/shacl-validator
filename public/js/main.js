const currentUrl = new URL(window.location.href);
const textarea = document.getElementById('input');
const highlightingContent = document.getElementById('highlighting-content');
const highlighting = document.getElementById('highlighting');
const output = document.getElementById('output');
const filePicker = document.getElementById('filePicker');

function updateHighlight() {
    let text = textarea.value;
    // Prism needs a space at the end to correctly render the final newline
    if (text[text.length - 1] === "\n") text += " ";
    highlightingContent.textContent = text;
    Prism.highlightElement(highlightingContent);
}

function encodeToBase64URL(str) {
  const base64 = btoa(encodeURIComponent(str));
  return base64;
}

function decodeFromBase64URL(base64) {
  const str = decodeURIComponent(atob(base64));
  return str;
}

function updateSearchParam(text) {
    const encodedValue = encodeToBase64URL(text);
    if (text) {
      currentUrl.searchParams.set('data', encodedValue);
    }
    else {
      currentUrl.searchParams.delete('data');
    }
    window.history.pushState({}, '', currentUrl);
}

textarea.addEventListener('scroll', () => {
    highlighting.scrollTop = textarea.scrollTop;
    highlighting.scrollLeft = textarea.scrollLeft;
});

textarea.addEventListener('input', updateHighlight);

// Handle the file picker...
filePicker.addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        textarea.value = e.target.result;
        updateHighlight();
       // updateSearchParam(textarea.value);
    };
    reader.readAsText(file);
});

// Update the data search param when the text-area is updated
textarea.addEventListener('input', function() {
    // updateSearchParam(this.value);
});

// Validate button clicked...
document.getElementById('send').addEventListener('click', async () => {
    const content = textarea.value.trim();

    if (!content) return;

    output.innerHTML = `<div class="spinner-border spinner-border-sm text-primary"></div> Processing...`;

    try {
        const validateUrl = new URL('/validate', window.location.origin);
        const response = await fetch(validateUrl.toString(), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/ld+json',
            'Referer': ''
          },
          body: content
        });
        
        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const res = await response.json();

        if (res.error) {
          output.innerHTML = `<span class="error">Error: ${res.error}</span>`;
        }
        else {
          output.innerHTML = res['result'] || 'Validation successful (no details returned).';
        }
      } catch (err) {
        output.innerHTML = `<span class="error">Error: ${err.message}</span>`;
      }
});

// Clear button clicked...
document.getElementById('clear').addEventListener('click', () => {
    textarea.value = '';
    updateHighlight();
    updateSearchParam('');
    output.innerHTML = 'Results will appear here...';
});

// Dynamically set the app-name and app-title
document.getElementById('app-name').innerHTML = window._env_.APP_NAME;
document.getElementById('app-title').innerHTML = window._env_.APP_TITLE;
document.getElementById('title').innerHTML = window._env_.APP_TITLE;

// Create a URL with a data param
document.getElementById('copyBtn').addEventListener('click', () => {
    const copyUrl = new URL(window.location.href);
    const encodedValue = encodeToBase64URL(textarea.value);
    copyUrl.searchParams.set('data', encodedValue);
    navigator.clipboard.writeText(copyUrl.href);
    const btn = document.getElementById('copyBtn');
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy URL', 2000);
});

// Set the textarea based on the data param
const dataParam = currentUrl.searchParams.get('data');
if (dataParam) {
    textarea.value = decodeFromBase64URL(dataParam);
    updateHighlight();
}