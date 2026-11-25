import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import DocsPage from './DocsPage.jsx'
import './index.css'

const isDocsPage = window.location.pathname.replace(/\/$/, '') === '/docs'
const RootPage = isDocsPage ? DocsPage : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootPage />
  </React.StrictMode>,
)
