// @ts-nocheck
// This file operates in the context of the web page (ChatGPT, Claude, etc.)

/**
 * Determines the active text input area on the page.
 * Supports standard textareas, inputs, and contenteditable divs common in AI chats.
 */
function getActiveInput(): HTMLElement | null {
  const active = document.activeElement as HTMLElement;
  
  if (
    active && 
    (active.tagName === 'TEXTAREA' || 
     active.tagName === 'INPUT' || 
     active.getAttribute('contenteditable') === 'true')
  ) {
    return active;
  }

  // Fallback: Try to find common AI chat input selectors if activeElement is body
  const gptInput = document.querySelector('#prompt-textarea');
  if (gptInput) return gptInput as HTMLElement;

  const claudeInput = document.querySelector('div[contenteditable="true"]');
  if (claudeInput) return claudeInput as HTMLElement;

  return null;
}

/**
 * Reads text from the active input.
 */
function readInputText(element: HTMLElement): string {
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    return (element as HTMLInputElement).value;
  } else {
    // contenteditable
    return element.innerText || element.textContent || '';
  }
}

/**
 * Injects text into the active input using the best available method for React hydration compatibility.
 */
function injectText(element: HTMLElement, text: string) {
  element.focus();

  // Method 1: execCommand (Deprecated but most reliable for preserving undo stack and triggering events)
  const success = document.execCommand('insertText', false, text);

  // Method 2: Direct manipulation + Event dispatching (Modern fallback)
  if (!success) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      // Native input
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(element, text);
      } else {
        (element as HTMLInputElement).value = text;
      }
      
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable
      element.innerText = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_SELECTION') {
    const input = getActiveInput();
    if (input) {
      const text = readInputText(input);
      sendResponse({ payload: text });
    } else {
      // Try to get selected text if no input is focused
      const selection = window.getSelection()?.toString();
      sendResponse({ payload: selection || '' });
    }
  }

  if (request.type === 'INJECT_TEXT') {
    const input = getActiveInput();
    if (input && request.payload) {
      injectText(input, request.payload);
      sendResponse({ status: 'success' });
    } else {
      sendResponse({ status: 'error', error: 'No input field found' });
    }
  }
  
  return true; // Keep channel open
});

const SUPPORTED_HOSTS = [
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'gemini.google.com',
  'bard.google.com',
  'poe.com',
  'perplexity.ai',
  'www.perplexity.ai'
];

const PANEL_ID = 'prompt-smith-floating-panel';
const TOGGLE_ID = 'prompt-smith-floating-toggle';

function hostMatches(): boolean {
  const host = window.location.hostname;
  return SUPPORTED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function createOverlay() {
  if (!hostMatches()) return;
  if (document.getElementById(PANEL_ID)) return;

  const container = document.createElement('div');
  container.id = PANEL_ID;
  Object.assign(container.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    width: '420px',
    height: '600px',
    maxHeight: '80vh',
    background: 'rgba(8, 10, 20, 0.98)',
    borderRadius: '24px',
    boxShadow: '0 20px 45px rgba(3, 4, 26, 0.55)',
    border: '1px solid rgba(255,255,255,0.08)',
    overflow: 'hidden',
    zIndex: '2147483647',
    display: 'flex',
    flexDirection: 'column'
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '8px'
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', 'Close Prompt Smith');
  Object.assign(closeBtn.style, {
    width: '32px',
    height: '32px',
    borderRadius: '16px',
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer'
  });

  header.appendChild(closeBtn);
  container.appendChild(header);

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('index.html');
  iframe.style.border = 'none';
  iframe.style.flex = '1';
  iframe.style.width = '100%';
  iframe.style.background = 'transparent';
  container.appendChild(iframe);

  const toggleBtn = document.createElement('button');
  toggleBtn.id = TOGGLE_ID;
  Object.assign(toggleBtn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 25px 35px rgba(15, 16, 40, 0.45)',
    cursor: 'pointer',
    zIndex: '2147483646',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  } as CSSStyleDeclaration);

  let panelVisible = true;

  function getCloseIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:24px;height:24px">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
  }

  function getSparkleIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:26px;height:26px">
        <path fill-rule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.75 1.5a.75.75 0 01.75.75c0 5.056-2.383 9.555-6.084 12.436h.004c-1.228 1.894-3.654 3.415-5.539 4.034a2.89 2.89 0 01-1.897-.042l-2.377.792a.75.75 0 01-.949-.949l.792-2.377a2.89 2.89 0 01-.042-1.897c.619-1.885 2.14-4.311 4.034-5.539v.004zM13.5 4.5c0-1.13-1.74-2.05-3.5-2.5a6.64 6.64 0 00-1.272-.207c.018.422.05.835.094 1.239.316 2.906 2.496 5.262 5.343 5.768.317.055.64.083.963.083V4.5z" clip-rule="evenodd" />
      </svg>
    `;
  }

  function updateToggle() {
    if (panelVisible) {
      container.style.display = 'flex';
      toggleBtn.style.background = '#1f2933';
      toggleBtn.style.color = '#cbd5f5';
      toggleBtn.style.transform = 'rotate(90deg)';
      toggleBtn.innerHTML = getCloseIcon();
    } else {
      container.style.display = 'none';
      toggleBtn.style.background = 'linear-gradient(135deg,#4c1d95,#9333ea,#a855f7)';
      toggleBtn.style.color = '#fff';
      toggleBtn.style.transform = 'rotate(0deg)';
      toggleBtn.innerHTML = getSparkleIcon();
    }
  }

  closeBtn.addEventListener('click', () => {
    panelVisible = false;
    updateToggle();
  });

  toggleBtn.addEventListener('click', () => {
    panelVisible = !panelVisible;
    updateToggle();
  });

  updateToggle();

  document.body.appendChild(container);
  document.body.appendChild(toggleBtn);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createOverlay);
} else {
  createOverlay();
}
