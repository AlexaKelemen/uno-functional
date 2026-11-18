import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './redux/store'
import { restoreSession } from './redux/thunks/session'
import { BrowserRouter } from 'react-router'
import App from './App'
import '../assets/main.css'

store.dispatch(restoreSession())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
