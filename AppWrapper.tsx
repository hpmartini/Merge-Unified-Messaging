import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import Login from './components/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';

const AppWrapper: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/*" 
        element={
          <ProtectedRoute>
            <App />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default AppWrapper;
