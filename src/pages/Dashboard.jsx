import React from 'react';
import { useUser } from '../context/UserContext';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Users, UserCheck, UserX, Clock, Mail, Calendar } from 'lucide-react';

const Dashboard = () => {
    const { users } = useUser();

    // KPI Calculations
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'ATIVO').length;
    const blockedUsers = users.filter(u => u.status === 'BLOQUEADO').length;
    const inactiveUsers = users.filter(u => u.status === 'INATIVO').length;

    // Calculate users with real email (not default)
    const usersWithEmail = users.filter(u => u.email && u.email !== 'N/A' && !u.email.includes('@email.com')).length;

    // Calculate users modified today
    const today = new Date().toDateString();
    const modifiedToday = users.filter(u => {
        if (!u.last_modified) return false;
        return new Date(u.last_modified).toDateString() === today;
    }).length;

    // Status Distribution for Pie Chart
    const statusData = [
        { name: 'Ativos', value: activeUsers, color: '#10b981' },
        { name: 'Bloqueados', value: blockedUsers, color: '#ef4444' },
        { name: 'Inativos', value: inactiveUsers, color: '#94a3b8' }
    ].filter(item => item.value > 0);

    // Email Domain Analysis (Top 5)
    const domainData = users.reduce((acc, user) => {
        if (!user.email || user.email === 'N/A') return acc;
        const domain = user.email.includes('@') ? user.email.split('@')[1] : 'Sem domínio';
        const existing = acc.find(item => item.name === domain);
        if (existing) {
            existing.value++;
        } else {
            acc.push({ name: domain, value: 1 });
        }
        return acc;
    }, []).sort((a, b) => b.value - a.value).slice(0, 5);

    const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];

    // Recent Users
    const recentUsers = [...users]
        .sort((a, b) => {
            const dateA = a.last_modified ? new Date(a.last_modified) : new Date(0);
            const dateB = b.last_modified ? new Date(b.last_modified) : new Date(0);
            return dateB - dateA;
        })
        .slice(0, 5);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Dashboard Gerencial</h2>
                <div className="text-sm text-slate-500">
                    Última atualização: {new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Total de Usuários</p>
                        <h3 className="text-2xl font-bold text-slate-800">{totalUsers}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Usuários Ativos</p>
                        <h3 className="text-2xl font-bold text-slate-800">{activeUsers}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                        <UserX size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Bloqueados</p>
                        <h3 className="text-2xl font-bold text-slate-800">{blockedUsers}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-lg">
                        <UserX size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Inativos</p>
                        <h3 className="text-2xl font-bold text-slate-800">{inactiveUsers}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Distribution Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Distribuição por Status</h3>
                    <div className="h-64 min-h-[256px] w-full">
                        <ResponsiveContainer width="100%" height={256}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Email Domains Bar Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Top 5 Domínios de Email</h3>
                    <div className="h-64 min-h-[256px] w-full">
                        {domainData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={256}>
                                <BarChart data={domainData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                        angle={-15}
                                        textAnchor="end"
                                        height={60}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                        {domainData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                Sem dados de domínios disponíveis
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activities Table */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Clock size={20} className="text-slate-400" />
                        <h3 className="text-lg font-semibold text-slate-800">Atividades Recentes</h3>
                    </div>
                    {modifiedToday > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar size={16} className="text-blue-500" />
                            <span className="text-slate-600">
                                <span className="font-semibold text-blue-600">{modifiedToday}</span> modificações hoje
                            </span>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                                <th className="pb-3 font-medium">Usuário</th>
                                <th className="pb-3 font-medium">Login</th>
                                <th className="pb-3 font-medium">Email</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium text-right">Última Modificação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {recentUsers.map((user) => (
                                <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-3 font-medium text-slate-700">{user.name}</td>
                                    <td className="py-3 text-slate-500 font-mono text-xs">{user.login}</td>
                                    <td className="py-3 text-slate-500 text-xs">{user.email || 'N/A'}</td>
                                    <td className="py-3">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.status === 'ATIVO'
                                                ? 'bg-green-50 text-green-700'
                                                : user.status === 'BLOQUEADO'
                                                    ? 'bg-red-50 text-red-700'
                                                    : 'bg-slate-50 text-slate-700'
                                            }`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-right text-xs text-slate-400">
                                        {user.last_modified
                                            ? new Date(user.last_modified).toLocaleDateString('pt-BR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'N/A'
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
