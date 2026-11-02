import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { queryClient } from './lib/queryClient';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <App />
              <Toaster
                position="top-right"
                gutter={10}
                toastOptions={{
                  duration: 4000,
                  className:
                    '!rounded-xl !border !border-slate-700/60 !bg-navy-900 !px-4 !py-3 !text-sm !text-slate-100 !shadow-lift',
                  success: { iconTheme: { primary: '#34d399', secondary: '#0b1220' } },
                  error: { iconTheme: { primary: '#fb7185', secondary: '#0b1220' } },
                }}
              />
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
