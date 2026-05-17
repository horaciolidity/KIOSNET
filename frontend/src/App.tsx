import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import CustomerDisplay from './pages/CustomerDisplay';
import Inventory from './pages/Inventory';
import Cash from './pages/Cash';
import History from './pages/History';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import Layout from './components/layout/Layout';
import { useAuthStore } from './store/useAuthStore';
import { useInventoryStore } from './store/useInventoryStore';
import { useCustomerStore } from './store/useCustomerStore';
import { useCashStore } from './store/useCashStore';

const App: React.FC = () => {
  const { user } = useAuthStore();
  const fetchProducts = useInventoryStore((state) => state.fetchProducts);
  const fetchCustomers = useCustomerStore((state) => state.fetchCustomers);
  const fetchActiveSession = useCashStore((state) => state.fetchActiveSession);

  React.useEffect(() => {
    if (user) {
      fetchProducts();
      fetchCustomers();
      fetchActiveSession();
    }
  }, [user, fetchProducts, fetchCustomers, fetchActiveSession]);

  const isEmployee = user?.role === 'EMPLOYEE';

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        
        <Route 
          path="/dashboard" 
          element={user ? <Layout><Dashboard /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/pos" 
          element={user ? <Layout><POS /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/inventory" 
          element={user ? <Layout><Inventory /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/cash" 
          element={user ? <Layout><Cash /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/history" 
          element={user ? <Layout><History /></Layout> : <Navigate to="/login" />} 
        />
        <Route 
          path="/reports" 
          element={user ? (!isEmployee ? <Layout><Reports /></Layout> : <Navigate to="/dashboard" />) : <Navigate to="/login" />} 
        />
        <Route 
          path="/settings" 
          element={user ? (!isEmployee ? <Layout><Settings /></Layout> : <Navigate to="/dashboard" />) : <Navigate to="/login" />} 
        />
        <Route 
          path="/customers" 
          element={user ? (!isEmployee ? <Layout><Customers /></Layout> : <Navigate to="/dashboard" />) : <Navigate to="/login" />} 
        />
        <Route 
          path="/display" 
          element={user ? <CustomerDisplay /> : <Navigate to="/login" />} 
        />

        {/* Redirects */}
        <Route path="/" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
};

export default App;
