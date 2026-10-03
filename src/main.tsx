import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthGate } from './components/AuthGate.tsx';

// Apply the saved theme before the first render so screens shown ahead of
// App (the AuthGate loading and sign-in views) use the same palette. App
// keeps the class in sync afterwards; dark is its default when unset.
try {
  const savedDarkMode = localStorage.getItem('omnilink_dark_mode');
  document.documentElement.classList.toggle('dark', savedDarkMode === null || savedDarkMode === 'true');
} catch {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate><App /></AuthGate>
  </StrictMode>,
);
