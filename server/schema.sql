CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    profile VARCHAR(50) NOT NULL,
    company VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'ATIVO',
    cpf VARCHAR(20) NOT NULL,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL,
    target_user_id INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Data (Initial Mock Data)
INSERT INTO users (name, login, email, profile, company, status, cpf) VALUES
('Ana Silva', 'ana.silva', 'ana.silva@techcorp.com', 'MASTER', 'TechCorp', 'ATIVO', '123.456.789-00'),
('Carlos Souza', 'carlos.souza', 'carlos.souza@logistica.com', 'OPERACIONAL', 'Logistica Express', 'BLOQUEADO', '234.567.890-11'),
('Beatriz Costa', 'beatriz.costa', 'beatriz.costa@techcorp.com', 'OPERACIONAL', 'TechCorp', 'ATIVO', '345.678.901-22'),
('João Oliveira', 'joao.oliveira', 'joao.oliveira@varejo.com', 'MASTER', 'Varejo Plus', 'ATIVO', '456.789.012-33'),
('Fernanda Lima', 'fernanda.lima', 'fernanda.lima@techcorp.com', 'OPERACIONAL', 'TechCorp', 'ATIVO', '567.890.123-44')
ON CONFLICT (login) DO NOTHING;
