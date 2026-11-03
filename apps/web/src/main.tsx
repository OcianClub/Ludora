import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import App from './App'
import { applyTheme } from './styles/theme'
import { BASE_URL } from './services/config'
import { configureApiConnection } from './services/apiConnection'
import { ApiConnectionNotice } from './components/ApiConnectionNotice'

applyTheme()
configureApiConnection(BASE_URL)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ApiConnectionNotice />
  </React.StrictMode>,
)
