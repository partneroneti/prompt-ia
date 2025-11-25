export const initialUsers = [
    {
        id: 'USR-001',
        name: 'Ana Silva',
        login: 'ana.silva',
        email: 'ana.silva@techcorp.com',
        profile: 'MASTER',
        company: 'TechCorp',
        status: 'ATIVO',
        cpf: '123.456.789-00',
        lastModified: new Date().toISOString()
    },
    {
        id: 'USR-002',
        name: 'Carlos Santos',
        login: 'carlos.santos',
        email: 'carlos.santos@logistica.com',
        profile: 'OPERACIONAL',
        company: 'Logistica SA',
        status: 'BLOQUEADO',
        cpf: '987.654.321-11',
        lastModified: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: 'USR-003',
        name: 'Beatriz Costa',
        login: 'bia.costa',
        email: 'bia.costa@techcorp.com',
        profile: 'OPERACIONAL',
        company: 'TechCorp',
        status: 'ATIVO',
        cpf: '456.789.123-22',
        lastModified: new Date(Date.now() - 172800000).toISOString()
    },
    {
        id: 'USR-004',
        name: 'Daniel Oliveira',
        login: 'daniel.o',
        email: 'daniel.o@financeiro.com',
        profile: 'MASTER',
        company: 'Financeiro Ltda',
        status: 'ATIVO',
        cpf: '321.654.987-33',
        lastModified: new Date(Date.now() - 259200000).toISOString()
    },
    {
        id: 'USR-005',
        name: 'Eduardo Lima',
        login: 'edu.lima',
        email: 'edu.lima@techcorp.com',
        profile: 'OPERACIONAL',
        company: 'TechCorp',
        status: 'ATIVO',
        cpf: '789.123.456-44',
        lastModified: new Date(Date.now() - 345600000).toISOString()
    }
];
