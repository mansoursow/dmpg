import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ClientApp from './pages/ClientApp';
import Admin from './pages/Admin';
import { ToastProvider } from './components/Toast';

function PrivateRoute({ children, adminOnly = false }) {
  const token = localStorage.getItem('dmgp_token');
  const user  = JSON.parse(localStorage.getItem('dmgp_user') || 'null');
  if (!token) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"       element={<Landing />} />
          <Route path="/login"  element={<Login />} />
          <Route path="/app/*"  element={<PrivateRoute><ClientApp /></PrivateRoute>} />
          <Route path="/admin/*" element={<PrivateRoute adminOnly><Admin /></PrivateRoute>} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
