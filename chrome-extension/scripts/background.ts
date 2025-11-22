// Background service worker for the extension
// This keeps the extension active and can handle cross-component communication

// declare const chrome: any;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Prompt Smith Extension Installed');
});

// If we need to handle sidebar toggle or context menus in the future, 
// the listeners would go here.