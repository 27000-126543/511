import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Instruments from './pages/Instruments';
import InstrumentDetail from './pages/InstrumentDetail';
import Reservations from './pages/Reservations';
import ReservationForm from './pages/ReservationForm';
import Budget from './pages/Budget';
import Maintenance from './pages/Maintenance';
import Statistics from './pages/Statistics';
import Notifications from './pages/Notifications';
import UserManagement from './pages/UserManagement';
import EngineerWorkbench from './pages/EngineerWorkbench';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token } = useAuthStore();
  return token ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  const { fetchProfile, token } = useAuthStore();

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="instruments" element={<Instruments />} />
          <Route path="instruments/:id" element={<InstrumentDetail />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="reservations/new" element={<ReservationForm />} />
          <Route path="reservations/new/:instrumentId" element={<ReservationForm />} />
          <Route path="budget" element={<Budget />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="engineer" element={<EngineerWorkbench />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
