import './index.css';
import { initAxiosMock } from './utils/mock-db-client';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Initialize the fully local client-side database
initAxiosMock();

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
