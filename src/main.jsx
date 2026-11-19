import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { installApiAuthInterceptor } from './utils/authFetch.js'
import App from './App.jsx'

installApiAuthInterceptor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
