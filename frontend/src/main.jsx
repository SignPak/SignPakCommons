import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AuthProvider from './context/AuthProvider.jsx'
import LibraryProvider from './context/LibraryProvider.jsx'
import NotificationProvider from './context/NotificationProvider.jsx'
import RecordingProvider from './context/RecordingProvider.jsx'
import ThemeProvider from './context/ThemeProvider.jsx'
import UploadQueueProvider from './context/UploadQueueProvider.jsx'
import { installChunkReload } from './utils/chunkReload'

// A tab opened before a deploy reloads once when an old page chunk is gone (utils/chunkReload.js).
installChunkReload()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <UploadQueueProvider>
              <LibraryProvider>
                <RecordingProvider>
                  <App />
                </RecordingProvider>
              </LibraryProvider>
            </UploadQueueProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)
