import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Page } from './Page'
import { TextAnonymizerTool } from './components/text-anonymizer-tool'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page Tool={TextAnonymizerTool} />
  </StrictMode>,
)
