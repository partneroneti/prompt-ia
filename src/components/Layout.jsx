import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import FloatingChat from './FloatingChat';

const Layout = () => {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto relative">
                <div className="p-8 max-w-7xl mx-auto h-full">
                    <Outlet />
                </div>
                <FloatingChat />
            </main>
        </div>
    );
};

export default Layout;
