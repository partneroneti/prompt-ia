import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UserProvider } from './context/UserContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PromptManager from './pages/PromptManager';
import OperationsDashboard from './pages/OperationsDashboard';
import GroupsDashboard from './pages/GroupsDashboard';
import UserAuditReport from './pages/UserAuditReport';
import Reports from './pages/Reports';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    return (
        <AuthProvider>
            <UserProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/" element={
                            <ProtectedRoute>
                                <Layout />
                            </ProtectedRoute>
                        }>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={
                                <ProtectedRoute requiredPermission="dashboard">
                                    <Dashboard />
                                </ProtectedRoute>
                            } />
                            <Route path="prompt-manager" element={
                                <ProtectedRoute>
                                    <PromptManager />
                                </ProtectedRoute>
                            } />
                            <Route path="operations" element={
                                <ProtectedRoute requiredPermission="operations">
                                    <OperationsDashboard />
                                </ProtectedRoute>
                            } />
                            <Route path="groups" element={
                                <ProtectedRoute requiredPermission="groups">
                                    <GroupsDashboard />
                                </ProtectedRoute>
                            } />
                            <Route path="audit" element={
                                <ProtectedRoute requiredPermission="audit">
                                    <UserAuditReport />
                                </ProtectedRoute>
                            } />
                            <Route path="reports" element={
                                <ProtectedRoute requiredPermission="reports">
                                    <Reports />
                                </ProtectedRoute>
                            } />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </UserProvider>
        </AuthProvider>
    );
}

export default App;
