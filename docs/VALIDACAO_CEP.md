# Validação de CEP por Distritos

## Visão Geral

A validação de CEP foi redesenhada para funcionar baseada em **distritos autorizados** ao invés de faixas de CEP. Isso torna o sistema mais flexível e fácil de gerenciar.

## Como Funciona

### 1. Tabela de Distritos (`distritos`)

Uma nova tabela no Supabase armazena os distritos permitidos:

```sql
- id: uuid (primary key)
- distrito: text (nome do distrito, único)
- autorizado: boolean (se o distrito está autorizado)
- descricao: text (descrição opcional)
- created_at: timestamp
- updated_at: timestamp
```

**Distritos iniciais inseridos:**
- Pirituba
- Jaraguá
- São Domingos
- Anhanguera
- Perus

### 2. Fluxo de Validação

#### No Front-End (src/lib/validarCep.ts):

1. **Normalização do CEP**: Remove caracteres não numéricos
2. **Consulta ao ViaCEP**: Busca informações do CEP (bairro, cidade, UF)
3. **Busca distritos autorizados**: Consulta a tabela `distritos` no Supabase filtrando por `autorizado = true`
4. **Comparação**: Verifica se o bairro retornado pelo ViaCEP está na lista de distritos autorizados
5. **Retorno**: Retorna se o CEP é válido e autorizado com mensagem apropriada

#### Na Página de Cadastro (src/components/pages/AuthPage.tsx):

- Profissionais e estabelecimentos precisam validar o CEP
- O botão "Validar CEP" chama a função `validarCep()`
- Se autorizado, libera os campos adicionais do formulário
- Se negado, exibe mensagem informativa com o motivo

### 3. Vantagens da Nova Abordagem

✅ **Flexibilidade**: Adicionar/remover distritos é simples (basta editar a tabela)  
✅ **Segurança**: RLS garante que apenas admins possam modificar distritos  
✅ **Performance**: Consulta ao ViaCEP feita no front-end (não passa pelo Supabase)  
✅ **Transparência**: Usuário vê claramente qual bairro foi detectado e por que foi recusado  
✅ **Manutenibilidade**: Não precisa mais gerenciar faixas de CEP manualmente  

### 4. Políticas de Segurança (RLS)

```sql
-- Leitura pública dos distritos autorizados
CREATE POLICY "Distritos autorizados são públicos"
  ON distritos FOR SELECT
  USING (autorizado = true);

-- Apenas admins podem gerenciar
CREATE POLICY "Apenas admins podem gerenciar distritos"
  ON distritos FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  ));
```

### 5. Como Adicionar Novos Distritos

#### Via SQL (Supabase Dashboard):

```sql
INSERT INTO distritos (distrito, autorizado, descricao)
VALUES ('Nome do Distrito', true, 'Descrição opcional');
```

#### Via API (futuramente):

Criar uma interface administrativa onde admins possam:
- Listar todos os distritos
- Adicionar novos distritos
- Ativar/desativar distritos existentes
- Editar descrições

### 6. Mensagens de Validação

**CEP Válido e Autorizado:**
```
CEP válido! Bairro: Pirituba, São Paulo/SP
```

**CEP Válido mas NÃO Autorizado:**
```
Atualmente, apenas cadastros dos distritos da Subprefeitura de Pirituba são aceitos.
Seu bairro (Vila Maria) não está autorizado no momento.
Entre em contato para mais informações.
```

**CEP Inválido:**
```
CEP inválido. Digite um CEP com 8 dígitos.
```

### 7. Arquivos Modificados

- `supabase/migrations/20260222_distritos_table.sql` - Nova tabela
- `src/lib/validarCep.ts` - Helper de validação (novo)
- `src/components/pages/AuthPage.tsx` - Formulário de cadastro (atualizado)

### 8. Edge Function Antiga

A Edge Function `validate_cep` (que fazia validação via faixas de CEP) não é mais utilizada no fluxo de cadastro. Pode ser removida ou mantida para referência histórica.

## Testando

1. Execute a migration: `supabase db push` (ou rode manualmente no dashboard)
2. Teste com CEPs da região de Pirituba (ex: 02945-000)
3. Teste com CEPs de outras regiões para validar a recusa
4. Verifique no console do navegador os logs de validação

## Próximos Passos

- [ ] Criar interface administrativa para gerenciar distritos
- [ ] Adicionar analytics de CEPs recusados
- [ ] Cache de distritos autorizados no cliente (React Query)
- [ ] Testes automatizados do fluxo de validação
