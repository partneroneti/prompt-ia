-- ============================================
-- QUERY PARA VERIFICAR ROLES DO PERFIL MASTER
-- ============================================

-- Ver quais roles o perfil MASTER possui
SELECT 
    p.id_perfil,
    p.str_descricao as perfil_nome,
    r.id_role,
    r.str_descricao as role_nome,
    pr.id as relacionamento_id,
    pr.str_ativo as rel_ativo,
    r.str_ativo as role_ativo
FROM tb_perfil p
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
LEFT JOIN tb_role r ON pr.id_role = r.id_role
WHERE UPPER(p.str_descricao) = 'MASTER'
  AND p.str_ativo = 'A'
ORDER BY r.str_descricao;

-- Versão resumida (apenas nomes das roles)
SELECT 
    r.str_descricao as role_nome
FROM tb_perfil p
JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
JOIN tb_role r ON pr.id_role = r.id_role
WHERE UPPER(p.str_descricao) = 'MASTER'
  AND p.str_ativo = 'A'
  AND pr.str_ativo = 'A'
  AND r.str_ativo = 'A'
ORDER BY r.str_descricao;

-- Versão completa com contagem
SELECT 
    p.str_descricao as perfil_nome,
    COUNT(DISTINCT r.id_role) as total_roles,
    STRING_AGG(r.str_descricao, ', ' ORDER BY r.str_descricao) as roles_associadas
FROM tb_perfil p
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
WHERE UPPER(p.str_descricao) = 'MASTER'
  AND p.str_ativo = 'A'
GROUP BY p.id_perfil, p.str_descricao;

-- Verificar se o perfil MASTER existe e se tem roles
SELECT 
    CASE 
        WHEN p.id_perfil IS NULL THEN 'Perfil MASTER não encontrado'
        WHEN COUNT(r.id_role) = 0 THEN 'Perfil MASTER existe mas não possui roles associadas'
        ELSE CONCAT('Perfil MASTER possui ', COUNT(r.id_role), ' role(s)')
    END as status
FROM (SELECT 1) dummy
LEFT JOIN tb_perfil p ON UPPER(p.str_descricao) = 'MASTER' AND p.str_ativo = 'A'
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
GROUP BY p.id_perfil;

-- Comparar todos os perfis e suas roles
SELECT 
    p.str_descricao as perfil_nome,
    COUNT(DISTINCT r.id_role) as quantidade_roles,
    STRING_AGG(r.str_descricao, ', ' ORDER BY r.str_descricao) as roles_associadas
FROM tb_perfil p
LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
WHERE p.str_ativo = 'A'
GROUP BY p.id_perfil, p.str_descricao
ORDER BY p.str_descricao;
