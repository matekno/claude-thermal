# Claude Code POS Hook — Tickets con Psukim de Pirkei Avot

Imprime tickets físicos en una impresora térmica cuando ocurren eventos clave en Claude Code Desktop. Cada ticket incluye un pasuk aleatorio de Pirkei Avot.

## Arquitectura

```
Claude Code Desktop
    ├── HTTP hook ──────► Deno Deploy (main.ts)
    │   Notification                │
    │   TaskCompleted          Sefaria API
    │                          Claude Haiku
    └── Command hook (local)        │
        Stop                        ▼
        SessionEnd         deno-thermal (impresora)
          └─ lee transcript
             envía contexto
```

## Setup

### 1. Variables de entorno en Deno Deploy

```
THERMAL_API_KEY=BlmJMcZBEJUxH5DQNkLtqKaDHVy6s6or
THERMAL_URL=https://deno-thermal.deno.dev/print/json
ANTHROPIC_API_KEY=<tu API key>
HOOK_SECRET=<mismo valor que THERMAL_API_KEY o un token propio>
```

### 2. Deploy a Deno Deploy

```bash
deno deploy --project=claude-thermal main.ts
```

Anota la URL del deployment (ej. `https://claude-thermal.deno.dev`).

### 3. Instalar scripts locales

```bash
mkdir -p ~/.claude/hooks
cp scripts/stop-hook.ts ~/.claude/hooks/stop-hook.ts
cp scripts/session-hook.ts ~/.claude/hooks/session-hook.ts
```

### 4. Variables de entorno locales

En tu `~/.bashrc` o `~/.zshrc`:

```bash
export THERMAL_HOOK_URL=https://claude-thermal.deno.dev
export THERMAL_API_KEY=<tu HOOK_SECRET>
```

### 5. Configurar Claude Code

Editar `.claude/settings.json` y reemplazar `REPLACE_WITH_DENO_DEPLOY_URL` con la URL del deployment.

O copiar a `~/.claude/settings.json` para que aplique en todos los proyectos.

## Test manual

```bash
# Test Notification
curl -X POST https://claude-thermal.deno.dev/hook \
  -H "Content-Type: application/json" \
  -H "X-Thermal-Key: <HOOK_SECRET>" \
  -d '{
    "hook_event_name": "Notification",
    "message": "Claude necesita tu aprobacion para ejecutar bash",
    "notification_type": "permission_prompt",
    "cwd": "/mi/proyecto",
    "session_id": "test-123"
  }'

# Test TaskCompleted
curl -X POST https://claude-thermal.deno.dev/hook \
  -H "Content-Type: application/json" \
  -H "X-Thermal-Key: <HOOK_SECRET>" \
  -d '{
    "hook_event_name": "TaskCompleted",
    "task_description": "Implementar autenticacion JWT",
    "cwd": "/mi/proyecto",
    "session_id": "test-123"
  }'
```

## Tickets que imprime

| Evento | Contenido |
|--------|-----------|
| `Notification` | Alerta urgente + mensaje + pasuk |
| `TaskCompleted` | Nombre de tarea + pasuk |
| `Stop` | Resumen Haiku + archivos + tareas + pasuk |
| `SessionEnd` | Resumen completo de sesión + logros + pasuk |

## Rate limiting

- **Notification**: siempre imprime (mismo tipo max 1 cada 30s por sesión)
- **TaskCompleted**: siempre imprime
- **Stop**: máx 1 cada 3 minutos por sesión (configurable con `RATE_STOP_SECONDS`)
- **SessionEnd**: siempre imprime
