import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Create a CSS link to load Inter font from Google Fonts
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

// Enable dark mode based on system preference or localStorage
const setDarkMode = () => {
  if (
    localStorage.theme === 'dark' ||
    (!('theme' in localStorage) &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// Initial setup
setDarkMode();

// Watch for changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', setDarkMode);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
