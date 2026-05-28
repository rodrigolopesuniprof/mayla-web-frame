O `TopBar` (usado em Bem-Estar, Desafios, Serviços e Perfil) renderiza `<Avatar />` sem props, então sempre mostra as iniciais "MA". Já o `HomeTab` busca avatar do perfil próprio. Vamos fazer o `TopBar` buscar e refletir o avatar atual do usuário em todas as abas, com atualização imediata após troca.

Alterações:

1. **Criar `src/hooks/useMyAvatar.ts`** — hook usando React Query (`queryKey: ['my-avatar', userId]`) que:
   - obtém `auth.user`
   - faz `SELECT full_name, avatar_url, avatar_type FROM profiles WHERE user_id = ...`
   - retorna `{ avatarUrl, avatarType, initials }`
   - `staleTime: 60s`

2. **`src/components/mayla/TopBar.tsx`** — usar `useMyAvatar()` e passar `avatarUrl`, `avatarType`, `initials` ao `<Avatar />`.

3. **`src/components/mayla/AvatarCustomizerButton.tsx`** — após `handleSave` bem-sucedido, chamar `queryClient.invalidateQueries({ queryKey: ['my-avatar'] })` para que o TopBar atualize imediatamente em todas as abas.

4. **`src/components/mayla/HomeTab.tsx`** — opcionalmente migrar para o mesmo hook para consistência (mantém o avatar do header da Home sincronizado também). Edição mínima: passar a invalidar também esse cache (já coberto pelo passo 3 se migrar).

Sem alterações em backend, RLS, ProfileTab ou outras telas.