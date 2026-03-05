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

textarea.addEventListener('scroll', () => {
    highlighting.scrollTop = textarea.scrollTop;
    highlighting.scrollLeft = textarea.scrollLeft;
});

textarea.addEventListener('input', updateHighlight);

filePicker.addEventListener('change', async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        textarea.value = e.target.result;
        updateHighlight();
    };
    reader.readAsText(file);
});

document.getElementById('send').addEventListener('click', async () => {
    const content = textarea.value.trim();

    if (!content) return;

    output.innerHTML = `<div class="spinner-border spinner-border-sm text-primary"></div> Processing...`;

    try {
        const response = await fetch('/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/ld+json' },
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

document.getElementById('clear').addEventListener('click', () => {
    textarea.value = '';
    updateHighlight();
    output.innerHTML = 'Results will appear here...';
});

document.getElementById('app-name').innerHTML = window._env_.APP_NAME;
document.getElementById('app-title').innerHTML = window._env_.APP_TITLE;