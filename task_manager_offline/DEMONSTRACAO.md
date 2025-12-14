# Roteiro de Demonstração - Offline-First

## Pré-requisitos
1. Servidor backend rodando: `cd server && node server.js`
2. App Flutter instalado no dispositivo/emulador

## Cenário 1: Criação Offline
**Objetivo**: Demonstrar criação de tarefas sem conexão

1. ✅ Desabilitar WiFi/dados no dispositivo
2. ✅ Abrir o app (indicador vermelho deve aparecer)
3. ✅ Criar nova tarefa: "Comprar leite"
4. ✅ Observar badge "⏱" (pendente)
5. ✅ Reabilitar conexão
6. ✅ App sincroniza automaticamente
7. ✅ Badge muda para "✓" (sincronizada)

**Resultado esperado**: Tarefa criada localmente e sincronizada ao voltar online

## Cenário 2: Edição com Conflito (LWW)
**Objetivo**: Demonstrar resolução de conflito Last-Write-Wins

### Parte A: Configurar cenário de conflito
1. ✅ Com conexão online, criar tarefa: "Revisar código"
2. ✅ Aguardar sincronização
3. ✅ Desabilitar conexão
4. ✅ Editar tarefa localmente: "Revisar código - Frontend"
5. ✅ No servidor (via Postman/cURL), editar mesma tarefa: "Revisar código - Backend"

### Parte B: Sincronizar e observar conflito
6. ✅ Reabilitar conexão
7. ✅ App sincroniza automaticamente
8. ✅ Console mostra: "⚠️ Conflito detectado"
9. ✅ Versão mais recente vence (LWW)
10. ✅ Tarefa atualizada com versão vencedora

**Resultado esperado**: Conflito resolvido automaticamente usando timestamp

## Cenário 3: Fila de Operações
**Objetivo**: Demonstrar enfileiramento de múltiplas operações

1. ✅ Desabilitar conexão
2. ✅ Criar 3 tarefas: "A", "B", "C"
3. ✅ Editar tarefa "A"
4. ✅ Deletar tarefa "B"
5. ✅ Abrir tela de Status de Sincronização
6. ✅ Observar "5 operações na fila"
7. ✅ Reabilitar conexão
8. ✅ Sincronização processa todas operações em ordem
9. ✅ Fila limpa após sucesso

**Resultado esperado**: Todas operações processadas corretamente

## Cenário 4: Indicadores Visuais
**Objetivo**: Validar UX de sincronização

1. ✅ Indicador de conectividade (bolinha verde/vermelha)
2. ✅ Badges de status em cada tarefa
3. ✅ Botão de sincronização manual
4. ✅ RefreshIndicator (pull-to-refresh)
5. ✅ SnackBars informativos

## Verificação de Persistência
**Objetivo**: Garantir dados persistem após fechar app

1. ✅ Criar tarefas offline
# Roteiro de Demonstração - Offline-First

## Pré-requisitos
1. Node.js (v14+) instalado para rodar o mock server local (opcional)
2. App Flutter instalado no dispositivo/emulador

> Observação: Este repositório não inclui um backend real. Para facilitar testes locais criei um mock server em `mock-server/` (Node/Express). Use-o para testar sincronização local.

## Cenário 1: Criação Offline
**Objetivo**: Demonstrar criação de tarefas sem conexão

1. ✅ Desabilitar WiFi/dados no dispositivo
2. ✅ Abrir o app (indicador vermelho deve aparecer)
3. ✅ Criar nova tarefa: "Comprar leite"
4. ✅ Observar badge "⏱" (pendente)
5. ✅ Reabilitar conexão
6. ✅ App sincroniza automaticamente
7. ✅ Badge muda para "✓" (sincronizada)

**Resultado esperado**: Tarefa criada localmente e sincronizada ao voltar online

## Cenário 2: Edição com Conflito (LWW)
**Objetivo**: Demonstrar resolução de conflito Last-Write-Wins

### Parte A: Configurar cenário de conflito
1. ✅ Com conexão online, criar tarefa: "Revisar código"
2. ✅ Aguardar sincronização
3. ✅ Desabilitar conexão
4. ✅ Editar tarefa localmente: "Revisar código - Frontend"
5. ✅ No servidor (via Postman/cURL) editar mesma tarefa: "Revisar código - Backend"

### Parte B: Sincronizar e observar conflito
6. ✅ Reabilitar conexão
7. ✅ App sincroniza automaticamente
8. ✅ Console mostra: "⚠️ Conflito detectado"
9. ✅ Versão mais recente vence (LWW)
10. ✅ Tarefa atualizada com versão vencedora

**Resultado esperado**: Conflito resolvido automaticamente usando timestamp

## Cenário 3: Fila de Operações
**Objetivo**: Demonstrar enfileiramento de múltiplas operações

1. ✅ Desabilitar conexão
2. ✅ Criar 3 tarefas: "A", "B", "C"
3. ✅ Editar tarefa "A"
4. ✅ Deletar tarefa "B"
5. ✅ Abrir tela de Status de Sincronização
6. ✅ Observar "5 operações na fila"
7. ✅ Reabilitar conexão
8. ✅ Sincronização processa todas operações em ordem
9. ✅ Fila limpa após sucesso

**Resultado esperado**: Todas operações processadas corretamente

## Cenário 4: Indicadores Visuais
**Objetivo**: Validar UX de sincronização

1. ✅ Indicador de conectividade (bolinha verde/vermelha)
2. ✅ Badges de status em cada tarefa
3. ✅ Botão de sincronização manual
4. ✅ RefreshIndicator (pull-to-refresh)
5. ✅ SnackBars informativos

## Verificação de Persistência
**Objetivo**: Garantir dados persistem após fechar app

1. ✅ Criar tarefas offline
2. ✅ Fechar app completamente
3. ✅ Reabrir app (sem conexão)
4. ✅ Tarefas ainda visíveis
5. ✅ Conectar e sincronizar

**Resultado esperado**: Dados persistidos localmente

## Como rodar o mock server e o app

1) Iniciar mock server (opcional, recomendado para testar sincronização):

```bash
cd mock-server
npm install
npm start
```

O mock server escutará em `http://localhost:3000`.

2) Em outro terminal, rodar o app Flutter (ex.: macOS):

```bash
flutter pub get
flutter run -d macos
```

3) Testes rápidos:

- Abra `http://localhost:3000/api/tasks` no browser para ver a lista (GET)
- Crie/edite/delete via app; observe logs do mock-server e mensagens de sincronização no app

4) Para limpar/reset do app:

```bash
flutter clean
flutter pub get
```
