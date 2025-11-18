# 🧹 Como Limpar Cache e Ver as Mudanças

## No Tablet/Mobile

### Safari (iOS/iPad)
1. Abra **Configurações** do iPad
2. Role até **Safari**
3. Toque em **Limpar Histórico e Dados de Website**
4. Confirme

**OU (mais rápido):**
1. No Safari, mantenha pressionado o botão de **recarregar** (↻)
2. Solte quando aparecer o menu
3. Toque em **Recarregar sem Cache**

### Chrome/Edge no Android/Tablet
1. Toque nos **três pontos** (⋮) no canto superior direito
2. Toque em **Configurações**
3. Toque em **Privacidade e segurança**
4. Toque em **Limpar dados de navegação**
5. Selecione:
   - ✅ Cookies e dados de sites
   - ✅ Imagens e arquivos armazenados em cache
6. Toque em **Limpar dados**

**OU (Hard Reload):**
1. Abra o site
2. Toque nos **três pontos** (⋮)
3. Toque em **⚙️ Configurações**
4. Toque em **Configurações do site**
5. Encontre seu site e toque em **Limpar e redefinir**

### Firefox no Tablet
1. Toque nos **três pontos** (⋮)
2. Toque em **Configurações**
3. Toque em **Excluir dados de navegação**
4. Selecione **Cache** e **Cookies**
5. Toque em **Excluir dados de navegação**

## No Desktop

### Chrome/Edge
- **Windows/Linux:** `Ctrl + Shift + R` ou `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`

### Firefox
- **Windows/Linux:** `Ctrl + Shift + R` ou `Ctrl + F5`
- **Mac:** `Cmd + Shift + R`

### Safari
- **Mac:** `Cmd + Option + R`

---

## Para Desenvolvedores: Rebuild Completo

Se você está rodando o projeto localmente:

```bash
# 1. Parar o servidor (Ctrl+C)

# 2. Limpar cache do Angular
rm -rf .angular/cache

# 3. Limpar node_modules (opcional, se houver problemas)
# rm -rf node_modules
# npm install

# 4. Rebuild e restart
npm run start
```

Depois acesse: `http://localhost:4200` e faça um **Hard Reload** no navegador.
