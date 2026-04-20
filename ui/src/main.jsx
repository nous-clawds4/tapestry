import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import { TrustProvider } from './context/TrustContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider>
      <AuthProvider>
        <TrustProvider>
          <App />
        </TrustProvider>
      </AuthProvider>
    </ConfigProvider>
  </StrictMode>,
)
