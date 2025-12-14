Mock server for Task Manager Offline demo

Usage:

1. Install dependencies:

```bash
cd mock-server
npm install
```

2. Start server:

```bash
npm start
```

3. Endpoints:

- GET  /api/tasks        -> { ok: true, data: [...] }
- POST /api/tasks        -> create task (body = task)
- PUT  /api/tasks/:id    -> update task
- DELETE /api/tasks/:id  -> delete task
- POST /api/_reset       -> reset in-memory tasks (body: { tasks: [] })

The server listens on port 3000 by default.
