-- Script SQL para buscar usuários por str_login
-- Execute este script diretamente no banco de dados

-- Buscar todos os logins (primeiros 50)
SELECT 
    id_usuario as id,
    str_login as login,
    str_descricao as name,
    email,
    str_cpf as cpf,
    CASE WHEN bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status
FROM tb_usuario 
WHERE str_login IS NOT NULL
ORDER BY str_login
LIMIT 50;

-- Buscar por login específico (exemplo: luis.eri.santos)
-- SELECT 
--     id_usuario as id,
--     str_login as login,
--     str_descricao as name,
--     email,
--     str_cpf as cpf,
--     CASE WHEN bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status
-- FROM tb_usuario 
-- WHERE str_login = 'luis.eri.santos';

-- Buscar por login parcial (exemplo: contém "luis")
-- SELECT 
--     id_usuario as id,
--     str_login as login,
--     str_descricao as name,
--     email,
--     str_cpf as cpf,
--     CASE WHEN bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status
-- FROM tb_usuario 
-- WHERE str_login ILIKE '%luis%'
-- ORDER BY str_login;


