-- ============================================
-- QUERIES PARA ROLES, PERFIS E RELAÇÕES
-- ============================================

-- ============================================
-- 1. VISUALIZAÇÃO BÁSICA DAS TABELAS
-- ============================================

-- 1.1. Listar todas as roles disponíveis
SELECT 
    id_role,
    str_descricao as role_nome,
    str_ativo,
    CASE 
        WHEN str_ativo = 'A' THEN 'ATIVO'
        WHEN str_ativo = 'E' THEN 'INATIVO'
        ELSE 'DESCONHECIDO'
    END as status
FROM tb_role
ORDER BY str_descricao;

-- 1.2. Listar todos os relacionamentos perfil-role
SELECT 
    pr.id as id_relacionamento,
    pr.id_perfil,
    p.str_descricao as perfil_nome,
    pr.id_role,
    r.str_descricao as role_nome,
    pr.str_ativo as rel_ativo,
    p.str_ativo as perfil_ativo,
    r.str_ativo as role_ativo
FROM tb_perfil_role pr
JOIN tb_perfil p ON pr.id_perfil = p.id_perfil
JOIN tb_role r ON pr.id_role = r.id_role
ORDER BY p.str_descricao, r.str_descricao;

-- 1.3. Listar todos os relacionamentos usuario-perfil
SELECT 
    up.id as id_relacionamento,
    up.id_usuario,
    u.str_descricao as usuario_nome,
    u.str_login as usuario_login,
    up.id_perfil,
    p.str_descricao as perfil_nome,
    up.str_ativo as rel_ativo,
    u.str_ativo as usuario_ativo,
    p.str_ativo as perfil_ativo
FROM tb_usuario_perfil up
JOIN tb_usuario u ON up.id_usuario = u.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
ORDER BY u.str_descricao, p.str_descricao;

-- ============================================
-- 2. RELAÇÕES COMPLETAS
-- ============================================

-- 2.1. Usuários com seus perfis e roles (visão completa)
SELECT 
    u.id_usuario,
    u.str_descricao as usuario_nome,
    u.str_login,
    u.email,
    p.id_perfil,
    p.str_descricao as perfil_nome,
    r.id_role,
    r.str_descricao as role_nome,
    STRING_AGG(DISTINCT r.str_descricao, ', ') OVER (PARTITION BY u.id_usuario, p.id_perfil) as roles_do_perfil
FROM tb_usuario u
JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
LEFT JOIN tb_role r ON pr.id_role = r.id_role
WHERE u.str_ativo = 'A' 
  AND up.str_ativo = 'A'
  AND p.str_ativo = 'A'
  AND (r.str_ativo = 'A' OR r.str_ativo IS NULL)
ORDER BY u.str_descricao, p.str_descricao, r.str_descricao;

-- 2.2. Resumo: Usuários com todos os seus perfis e roles agregadas
SELECT 
    u.id_usuario,
    u.str_descricao as usuario_nome,
    u.str_login,
    STRING_AGG(DISTINCT p.str_descricao, ', ') as perfis,
    STRING_AGG(DISTINCT r.str_descricao, ', ') as roles
FROM tb_usuario u
JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
LEFT JOIN tb_role r ON pr.id_role = r.id_role
WHERE u.str_ativo = 'A' 
  AND up.str_ativo = 'A'
  AND p.str_ativo = 'A'
  AND (r.str_ativo = 'A' OR r.str_ativo IS NULL)
GROUP BY u.id_usuario, u.str_descricao, u.str_login
ORDER BY u.str_descricao;

-- 2.3. Perfis com suas roles associadas
SELECT 
    p.id_perfil,
    p.str_descricao as perfil_nome,
    STRING_AGG(r.str_descricao, ', ') as roles_associadas,
    COUNT(DISTINCT r.id_role) as quantidade_roles
FROM tb_perfil p
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
WHERE p.str_ativo = 'A'
GROUP BY p.id_perfil, p.str_descricao
ORDER BY p.str_descricao;

-- ============================================
-- 3. CONSULTAS ÚTEIS PARA VERIFICAÇÃO
-- ============================================

-- 3.1. Perfis sem roles associadas
SELECT 
    p.id_perfil,
    p.str_descricao as perfil_nome
FROM tb_perfil p
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
WHERE p.str_ativo = 'A'
  AND pr.id IS NULL
ORDER BY p.str_descricao;

-- 3.2. Roles que não estão associadas a nenhum perfil
SELECT 
    r.id_role,
    r.str_descricao as role_nome
FROM tb_role r
LEFT JOIN tb_perfil_role pr ON r.id_role = pr.id_role AND pr.str_ativo = 'A'
WHERE r.str_ativo = 'A'
  AND pr.id IS NULL
ORDER BY r.str_descricao;

-- 3.3. Usuários sem perfis associados
SELECT 
    u.id_usuario,
    u.str_descricao as usuario_nome,
    u.str_login
FROM tb_usuario u
LEFT JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario AND up.str_ativo = 'A'
WHERE u.str_ativo = 'A'
  AND u.bloqueado = false
  AND up.id IS NULL
ORDER BY u.str_descricao;

-- 3.4. Perfis sem usuários associados
SELECT 
    p.id_perfil,
    p.str_descricao as perfil_nome
FROM tb_perfil p
LEFT JOIN tb_usuario_perfil up ON p.id_perfil = up.id_perfil AND up.str_ativo = 'A'
WHERE p.str_ativo = 'A'
  AND up.id IS NULL
ORDER BY p.str_descricao;

-- ============================================
-- 4. ESTATÍSTICAS
-- ============================================

-- 4.1. Total de roles ativas
SELECT COUNT(*) as total_roles_ativas
FROM tb_role
WHERE str_ativo = 'A';

-- 4.2. Total de perfis ativos
SELECT COUNT(*) as total_perfis_ativos
FROM tb_perfil
WHERE str_ativo = 'A';

-- 4.3. Total de relacionamentos perfil-role ativos
SELECT COUNT(*) as total_relacoes_perfil_role
FROM tb_perfil_role
WHERE str_ativo = 'A';

-- 4.4. Total de relacionamentos usuario-perfil ativos
SELECT COUNT(*) as total_relacoes_usuario_perfil
FROM tb_usuario_perfil
WHERE str_ativo = 'A';

-- 4.5. Média de roles por perfil
SELECT 
    AVG(role_count) as media_roles_por_perfil
FROM (
    SELECT 
        p.id_perfil,
        COUNT(DISTINCT r.id_role) as role_count
    FROM tb_perfil p
    LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
    LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
    WHERE p.str_ativo = 'A'
    GROUP BY p.id_perfil
) as perfil_roles;

-- ============================================
-- 5. QUERIES PARA AUDITORIA E DEBUG
-- ============================================

-- 5.1. Verificar relacionamentos inativos (soft delete)
SELECT 
    'PERFIL_ROLE' as tabela,
    COUNT(*) as quantidade_inativos
FROM tb_perfil_role
WHERE str_ativo != 'A' OR str_ativo IS NULL
UNION ALL
SELECT 
    'USUARIO_PERFIL' as tabela,
    COUNT(*) as quantidade_inativos
FROM tb_usuario_perfil
WHERE str_ativo != 'A' OR str_ativo IS NULL;

-- 5.2. Verificar inconsistências (relacionamentos com perfis/roles inativos)
SELECT 
    'PERFIL_ROLE com perfil inativo' as problema,
    pr.id as id_relacionamento
FROM tb_perfil_role pr
JOIN tb_perfil p ON pr.id_perfil = p.id_perfil
WHERE pr.str_ativo = 'A' AND p.str_ativo != 'A'
UNION ALL
SELECT 
    'PERFIL_ROLE com role inativa' as problema,
    pr.id as id_relacionamento
FROM tb_perfil_role pr
JOIN tb_role r ON pr.id_role = r.id_role
WHERE pr.str_ativo = 'A' AND r.str_ativo != 'A'
UNION ALL
SELECT 
    'USUARIO_PERFIL com usuario inativo' as problema,
    up.id as id_relacionamento
FROM tb_usuario_perfil up
JOIN tb_usuario u ON up.id_usuario = u.id_usuario
WHERE up.str_ativo = 'A' AND (u.str_ativo != 'A' OR u.bloqueado = true)
UNION ALL
SELECT 
    'USUARIO_PERFIL com perfil inativo' as problema,
    up.id as id_relacionamento
FROM tb_usuario_perfil up
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
WHERE up.str_ativo = 'A' AND p.str_ativo != 'A';

-- ============================================
-- 6. QUERIES PARA PERMISSÕES ESPECÍFICAS
-- ============================================

-- 6.1. Quais usuários têm uma role específica (exemplo: USER_CREATE)
-- Substitua 'USER_CREATE' pela role desejada
SELECT 
    u.id_usuario,
    u.str_descricao as usuario_nome,
    u.str_login,
    p.str_descricao as perfil,
    r.str_descricao as role
FROM tb_usuario u
JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
JOIN tb_perfil p ON up.id_perfil = p.id_perfil
JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
JOIN tb_role r ON pr.id_role = r.id_role
WHERE u.str_ativo = 'A'
  AND up.str_ativo = 'A'
  AND p.str_ativo = 'A'
  AND pr.str_ativo = 'A'
  AND r.str_ativo = 'A'
  AND UPPER(r.str_descricao) = 'USER_CREATE'  -- Altere aqui
ORDER BY u.str_descricao;

-- 6.2. Quais perfis têm uma role específica
SELECT 
    p.id_perfil,
    p.str_descricao as perfil_nome,
    r.str_descricao as role
FROM tb_perfil p
JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
JOIN tb_role r ON pr.id_role = r.id_role
WHERE p.str_ativo = 'A'
  AND pr.str_ativo = 'A'
  AND r.str_ativo = 'A'
  AND UPPER(r.str_descricao) = 'USER_UPDATE'  -- Altere aqui
ORDER BY p.str_descricao;

-- 6.3. Todas as roles e quantos perfis têm cada uma
SELECT 
    r.id_role,
    r.str_descricao as role_nome,
    COUNT(DISTINCT pr.id_perfil) as quantidade_perfis,
    STRING_AGG(DISTINCT p.str_descricao, ', ') as perfis_com_essa_role
FROM tb_role r
LEFT JOIN tb_perfil_role pr ON r.id_role = pr.id_role AND pr.str_ativo = 'A'
LEFT JOIN tb_perfil p ON pr.id_perfil = p.id_perfil AND p.str_ativo = 'A'
WHERE r.str_ativo = 'A'
GROUP BY r.id_role, r.str_descricao
ORDER BY quantidade_perfis DESC, r.str_descricao;

-- ============================================
-- 7. EXEMPLOS DE INSERÇÃO (para referência)
-- ============================================

-- 7.1. Criar uma nova role
/*
INSERT INTO tb_role (str_descricao, str_ativo)
VALUES ('NOVA_ROLE', 'A')
RETURNING id_role, str_descricao;
*/

-- 7.2. Associar role a um perfil
/*
INSERT INTO tb_perfil_role (id_perfil, id_role, str_ativo)
SELECT 
    (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A' LIMIT 1),
    (SELECT id_role FROM tb_role WHERE UPPER(str_descricao) = 'USER_CREATE' AND str_ativo = 'A' LIMIT 1),
    'A'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_perfil_role 
    WHERE id_perfil = (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A' LIMIT 1)
    AND id_role = (SELECT id_role FROM tb_role WHERE UPPER(str_descricao) = 'USER_CREATE' AND str_ativo = 'A' LIMIT 1)
)
RETURNING id, id_perfil, id_role;
*/

-- 7.3. Associar perfil a um usuário
/*
INSERT INTO tb_usuario_perfil (id_usuario, id_perfil, str_ativo)
SELECT 
    306,  -- Substitua pelo ID do usuário
    (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A' LIMIT 1),
    'A'
WHERE NOT EXISTS (
    SELECT 1 FROM tb_usuario_perfil 
    WHERE id_usuario = 306
    AND id_perfil = (SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'OPERACIONAL' AND str_ativo = 'A' LIMIT 1)
)
RETURNING id, id_usuario, id_perfil;
*/
