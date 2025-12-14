## LocalStack + Backend + App

### 1) Subir LocalStack (S3, SQS, SNS, DynamoDB)
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack
docker compose up -d
```
Isso cria automaticamente:
- Bucket S3 `shopping-images`
- Tabela DynamoDB `Tasks`
- Fila SQS `task-events`
- Tópico SNS `task-notifications`

### 2) Iniciar backend (mock-server)
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack/mock-server
npm install
npm start
```
Endpoint de saúde: `http://localhost:3000/api/health`

Se aparecer erro de fila/tópico inexistente (QueueDoesNotExist), crie-os:
```zsh
docker exec -it localstack awslocal sqs create-queue --queue-name task-events
docker exec -it localstack awslocal sns create-topic --name task-notifications
docker exec -it localstack awslocal sqs list-queues
docker exec -it localstack awslocal sns list-topics
```

### 3) Rodar o app Flutter (macOS)
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack/task_manager_offline
flutter clean
flutter pub get
flutter run -d macos
```

Para outros dispositivos:
```zsh
flutter run
flutter devices
```

### Fluxo
- Ao salvar uma tarefa com foto (online), o app faz upload para `S3` via `/api/upload`.
- A tarefa é criada/atualizada em `DynamoDB` via `/api/tasks`.
- Eventos são enviados para `SQS` e notificação publicada em `SNS`.

## 📝 Roteiro da Demonstração (Sala de Aula)

### 1) Infraestrutura: subir o LocalStack
Mostre o Docker Compose iniciando os serviços.
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack
docker compose up -d
docker logs -f localstack
```
No log, destaque a mensagem `Ready.`.

### 2) Configuração: criar e validar recursos (AWS CLI local)
Use o AWS CLI apontando para o endpoint local. Primeiro, crie TODOS os recursos usados pela demo (bucket, fila e tópico). Em seguida, valide.
```zsh
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws --endpoint-url=http://127.0.0.1:4566 s3 mb s3://shopping-images
aws --endpoint-url=http://127.0.0.1:4566 sqs create-queue --queue-name task-events
aws --endpoint-url=http://127.0.0.1:4566 sns create-topic --name task-notifications

# Validações
aws --endpoint-url=http://127.0.0.1:4566 s3 ls
aws --endpoint-url=http://127.0.0.1:4566 s3 ls s3://shopping-images
aws --endpoint-url=http://127.0.0.1:4566 sqs list-queues
aws --endpoint-url=http://127.0.0.1:4566 sns list-topics
```
Observação: se preferir, você pode executar os mesmos comandos dentro do contêiner com `awslocal`:
```zsh
docker exec -it localstack awslocal s3 mb s3://shopping-images
docker exec -it localstack awslocal sqs create-queue --queue-name task-events
docker exec -it localstack awslocal sns create-topic --name task-notifications
```

### 3) Ação: tirar foto e salvar no app
- Inicie o backend:
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack/mock-server
npm install
npm start
```
- Rode o app Flutter (macOS):
```zsh
cd /Users/pedrolucas/Documents/Facul/aplicacoesMoveis/localstack/localStack/task_manager_offline
flutter clean
flutter pub get
flutter run -d macos
```
- No app: clique em "Nova Tarefa" → "Tirar Foto".
	- No macOS, será aberto o seletor de arquivos (galeria). Escolha uma imagem.
	- Veja a miniatura aparecer e clique em "Criar Tarefa".

### 4) Validação: provar que a imagem foi salva no S3
Liste os objetos do bucket `shopping-images` e mostre a nova imagem.
```zsh
aws --endpoint-url=http://127.0.0.1:4566 s3 ls s3://shopping-images
```
Você deve ver algo como `photos/<uuid>.jpg`.

### ✅ Validação (S3 Local) — Passo a Passo
- Terminal (AWS CLI):
```zsh
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
aws --endpoint-url=http://127.0.0.1:4566 s3 ls s3://shopping-images --recursive
```
- Baixar um arquivo específico e abrir:
```zsh
aws --endpoint-url=http://127.0.0.1:4566 s3 cp s3://shopping-images/photos/<uuid>.jpg ./downloaded.jpg
open ./downloaded.jpg
```
- Dentro do contêiner (opcional) com `awslocal`:
```zsh
docker exec -it localstack awslocal s3 ls s3://shopping-images --recursive
```
- Via navegador ou curl (GET direto no LocalStack):
```zsh
curl -v "http://127.0.0.1:4566/shopping-images/photos/<uuid>.jpg" -o downloaded.jpg
open downloaded.jpg
```
O que observar: objetos com chave `photos/<uuid>.jpg` e tamanhos > 0 confirmam que o upload funcionou.

### 5) Dica de Sequência (quando rodar cada coisa)
- Primeiro: `docker compose up -d` e aguarde o `Ready.` no log.
- Segundo: execute os comandos de criação dos recursos (passo 2) — bucket, fila, tópico.
- Terceiro: inicie o backend (`npm start`). Se os recursos existirem, o backend não vai falhar.
- Quarto: rode o app Flutter, tire/seleciona a foto e salve a tarefa.


### Observações
- Se o backend retornar erro de tabela inexistente, ele agora cria automaticamente a tabela DynamoDB `Tasks` ao iniciar.
- Se o upload falhar com `QueueDoesNotExist`, crie a fila SQS `task-events` e o tópico SNS `task-notifications` (comandos acima) e reinicie o backend.
- Se o AWS CLI falhar em `localhost`, use `127.0.0.1:4566` para evitar issues de IPv6.
- Em iOS/Android, o botão abre a câmera; no macOS, usa seleção de arquivo.