import { Route, Routes } from 'react-router-dom'
import './App.css'
import Home from './page/home'
import NotFound from './page/notfound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
