import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './fonts';
import './styles.css';
import './product-chrome.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
