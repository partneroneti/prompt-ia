-- Script para criar o campo trocar_senha na tabela tb_usuario
-- Execute este script no banco de dados com um usuário que tenha permissão de ALTER TABLE

ALTER TABLE tb_usuario 
ADD COLUMN IF NOT EXISTS trocar_senha BOOLEAN DEFAULT false;

-- Verificar se o campo foi criado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tb_usuario' AND column_name = 'trocar_senha';

