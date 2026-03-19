-- Migração: Adicionar coluna 'nome' à tabela profiles e atualizar gatilho de novo usuário

-- 1. Adicionar a coluna nome
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome TEXT;

-- 2. Atualizar a função handle_new_user para capturar o nome do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, family_id, nome)
  VALUES (
    new.id, 
    new.email, 
    gen_random_uuid(), 
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar perfis existentes com nomes do metadata se disponíveis
UPDATE public.profiles p
SET nome = COALESCE(u.raw_user_meta_data->>'display_name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.nome IS NULL;
