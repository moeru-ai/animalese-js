import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { AnimaleseProvider } from './app/AnimaleseProvider'
import { Layout } from './app/Layout'
import { InventoryPage } from './routes/inventory/InventoryPage'
import { LivePage } from './routes/live/LivePage'
import { PipelinePage } from './routes/pipeline/PipelinePage'
import { SpeakPage } from './routes/speak/SpeakPage'

import './app/i18n'
import '@proj-airi/font-chillroundm/index.css'
import 'animal-island-ui/dist/index.css'
import './styles/app.css'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <SpeakPage /> },
      { path: 'live', element: <LivePage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
    ],
  },
], { basename: import.meta.env.BASE_URL })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnimaleseProvider>
      <RouterProvider router={router} />
    </AnimaleseProvider>
  </StrictMode>,
)
