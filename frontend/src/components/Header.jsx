import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, ExternalLink, ShieldCheck } from 'lucide-react';

export default function Header() {
  const [health, setHealth] = useState('checking');

  const checkHealth = async () => {
    try {
      const res = await fetch('/actuator/health');
      if (res.ok) {
        const data = await res.json();
        setHealth(data.status === 'UP' ? 'up' : 'down');
      } else {
        setHealth('down');
      }
    } catch {
      setHealth('offline');
    }
  };

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header>
      <div className="header-top">
        <div className="logo-group">
          <div className="logo-icon">⚡</div>
          <div>
            <div className="title-row">
              <h1>ForgeOrder</h1>
              <span className="react-pill">React 18</span>
            </div>
            <p className="tagline">
              Fault-Tolerant Distributed Order Orchestration & Concurrency Engine
            </p>
          </div>
        </div>

        <nav className="nav-links" aria-label="System Navigation">
          <div className={`badge-health ${health !== 'up' ? 'down' : ''}`}>
            <span className="dot-pulse"></span>
            {health === 'up' ? 'Backend Live' : health === 'down' ? 'Degraded' : 'Offline'}
          </div>

          <a href="/swagger-ui/index.html" target="_blank" rel="noreferrer" className="nav-btn">
            <BookOpen size={15} />
            <span>OpenAPI Docs</span>
            <ExternalLink size={12} />
          </a>

          <a href="http://localhost:15672" target="_blank" rel="noreferrer" className="nav-btn">
            <Activity size={15} />
            <span>RabbitMQ</span>
            <ExternalLink size={12} />
          </a>

          <a href="/actuator/health" target="_blank" rel="noreferrer" className="nav-btn">
            <ShieldCheck size={15} />
            <span>Actuator</span>
            <ExternalLink size={12} />
          </a>
        </nav>
      </div>
    </header>
  );
}
