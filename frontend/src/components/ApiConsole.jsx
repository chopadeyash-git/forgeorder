import React from 'react';
import { Terminal, Trash2 } from 'lucide-react';

export default function ApiConsole({ logs, onClear }) {
  return (
    <section className="card" aria-labelledby="heading-console">
      <div className="section-header">
        <h2 id="heading-console" className="card-title" style={{ marginBottom: 0 }}>
          <Terminal size={18} />
          <span>Real-Time API Trace & Log</span>
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="btn btn-secondary btn-sm"
          title="Clear console entries"
        >
          <Trash2 size={13} />
          <span>Clear</span>
        </button>
      </div>

      <div id="console-output" className="console-container" role="log" aria-live="polite">
        {logs.length === 0 ? (
          <div className="log-entry text-muted">[System Ready] Watching API calls...</div>
        ) : (
          logs.map((log) => {
            const statusClass =
              log.status >= 200 && log.status < 300
                ? 's2xx'
                : log.status >= 400 && log.status < 500
                ? 's4xx'
                : 's5xx';

            return (
              <div key={log.id} className="log-entry">
                <div>
                  <span className="log-time">[{log.time}]</span>
                  <span className={`log-method ${log.method}`}>{log.method}</span>
                  <span className="mono">{log.url}</span>
                  <span className={`log-status ${statusClass}`}>{log.status}</span>
                  {log.idempotencyKey && (
                    <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                      Key: <code className="mono">{log.idempotencyKey}</code>
                    </span>
                  )}
                </div>
                <div className="log-json">
                  {typeof log.data === 'string'
                    ? log.data
                    : JSON.stringify(log.data, null, 2)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
