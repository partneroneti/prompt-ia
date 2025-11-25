import React, { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [users, setUsers] = useState([]);
    const [auditLog, setAuditLog] = useState([]);

    // Load users from API on mount
    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    };

    const addUser = async (user) => {
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });

            if (response.ok) {
                const result = await response.json();
                setUsers(prev => [result.user, ...prev]);
                return result; // { user, auditId }
            }
        } catch (error) {
            console.error('Failed to add user:', error);
        }
        return null;
    };

    const blockUsersByCompany = async (companyName) => {
        try {
            const response = await fetch('/api/companies/block', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: companyName })
            });

            if (response.ok) {
                const result = await response.json();
                // Refresh users to show updated status
                fetchUsers();
                return result; // { count, auditId }
            }
        } catch (error) {
            console.error('Failed to block users:', error);
        }
        return { count: 0, auditId: 'ERROR' };
    };

    const resetPasswordsByCompany = async (companyName) => {
        try {
            const response = await fetch('/api/companies/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: companyName })
            });

            if (response.ok) {
                const result = await response.json();
                return result; // { count, auditId }
            }
        } catch (error) {
            console.error('Failed to reset passwords:', error);
        }
        return { count: 0, auditId: 'ERROR' };
    };

    const queryUsers = (filters) => {
        // For simple filtering in UI, we can still filter the local state
        // OR we could call the API. For "Quantos usuários...", let's filter local state to be fast
        // since we are loading all users anyway.
        return users.filter(user => {
            if (filters.status && user.status !== filters.status) return false;
            if (filters.company && !user.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
            if (filters.name && !user.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
            if (filters.login && !user.login.toLowerCase().includes(filters.login.toLowerCase())) return false;
            if (filters.email && !user.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
            if (filters.cpf && user.cpf !== filters.cpf) return false;
            if (filters.profile && user.profile !== filters.profile) return false;
            return true;
        });
    };

    return (
        <UserContext.Provider value={{ users, addUser, blockUsersByCompany, resetPasswordsByCompany, queryUsers, auditLog }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
