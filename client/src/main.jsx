import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MotionConfig } from 'motion/react';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { GatewayProvider } from './contexts/GatewayContext.jsx';
import GatewayWakeNotice from './components/GatewayWakeNotice.jsx';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <GatewayProvider>
          <AuthProvider><App /><GatewayWakeNotice /></AuthProvider>
        </GatewayProvider>
        <Toaster theme="dark" position="bottom-right" closeButton toastOptions={{ style: { background: '#131A23', border: '1px solid rgba(255,255,255,.08)', color: '#E6EDF3', fontFamily: 'Inter' } }} />
      </MotionConfig>
    </BrowserRouter>
  </React.StrictMode>,
);
