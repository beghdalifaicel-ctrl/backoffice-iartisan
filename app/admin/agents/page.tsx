'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Mail,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  BarChart3,
  RefreshCw,
  Settings,
  ArrowUpRight,
  Badge,
  Loader,
  Activity,
} from 'lucide-react';

const AGENT_TYPES = {
  ADMIN: { name: 'Admin', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  MARKETING: { name: 'Marketing', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' },
  COMMERCIAL: { name: 'Commercial', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' },
};

const STATUS_COLORS = {
  COMPLETED: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  PROCESSING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  FAILED: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  PENDING: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
};

interface DashboardData {
  kpis: {
    tasksToday: number;
    successRate: number;
    tokensMonth: number;
    costMonth: number;
    activeIntegrations: number;
  };
  agents: any[];
  recentTasks: any[];
  quota: any;
  integrations: any[];
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  return `${(seconds / 60).toFixed(1)}m`;
}

function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function AgentsDashboard() {
  const [clientId, setClientId] = useState('test-client-001');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agents/dashboard?clientId=${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const sortedTasks = data?.recentTasks
    ? [...data.recentTasks].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      })
    : [];

  if (loading && !data) {
    return (
      <div style={{ background: '#111827', minHeight: '100vh', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#9ca3af' }}>Loading agents dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#111827', minHeight: '100vh', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        table { border-collapse: collapse; width: 100%; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #1f2937; }
        th { background: #0f172a; font-weight: 600; cursor: pointer; user-select: none; }
        tr:hover { background: #1f2937; }
        button { cursor: pointer; border: none; transition: all 0.2s; }
        button:hover { transform: translateY(-2px); }
      `}</style>

      {/* Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid #1f2937' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Agent Management</h1>
              <p style={{ margin: '0', color: '#9ca3af', fontSize: '14px' }}>Real-time agent task monitoring and performance</p>
            </div>
            <button
              onClick={fetchData}
              style={{
                padding: '10px 16px',
                background: '#3b82f6',
                color: '#fff',
                borderRadius: '8px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {/* Client Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ color: '#9ca3af', fontSize: '14px' }}>Client ID:</label>
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{
                padding: '8px 12px',
                background: '#1f2937',
                color: '#fff',
                border: '1px solid #374151',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              <option>test-client-001</option>
              <option>test-client-002</option>
              <option>prod-client-001</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {error && (
          <div style={{ background: '#7f1d1d', color: '#fecaca', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
            Error: {error}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          {[
            { label: 'Tasks Today', value: data?.kpis.tasksToday || 0, icon: Activity, color: '#3b82f6' },
            { label: 'Success Rate', value: `${data?.kpis.successRate || 0}%`, icon: CheckCircle, color: '#10b981' },
            { label: 'Tokens Used (Month)', value: formatNumber(data?.kpis.tokensMonth || 0), icon: Zap, color: '#f59e0b' },
            { label: 'Active Integrations', value: data?.kpis.activeIntegrations || 0, icon: Badge, color: '#8b5cf6' },
          ].map((kpi, idx) => (
            <div
              key={idx}
              style={{
                background: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
              }}
            >
              <div style={{ background: kpi.color + '20', padding: '12px', borderRadius: '8px' }}>
                <kpi.icon size={24} color={kpi.color} />
              </div>
              <div>
                <p style={{ margin: '0', color: '#9ca3af', fontSize: '13px' }}>{kpi.label}</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '28px', fontWeight: '700' }}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Agent Status Cards */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={24} /> Agent Status
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {['ADMIN', 'MARKETING', 'COMMERCIAL'].map(agentType => {
              const agent = data?.agents?.find(a => a.agent_type === agentType);
              const config = AGENT_TYPES[agentType as keyof typeof AGENT_TYPES];
              const agentTasks = data?.recentTasks?.filter(t => t.agent_type === agentType) || [];
              const completed = agentTasks.filter(t => t.status === 'COMPLETED').length;
              const processing = agentTasks.filter(t => t.status === 'PROCESSING').length;
              const failed = agentTasks.filter(t => t.status === 'FAILED').length;

              return (
                <div
                  key={agentType}
                  style={{
                    background: '#1f2937',
                    border: `2px solid ${config.color}`,
                    borderRadius: '12px',
                    padding: '20px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0', fontSize: '16px', fontWeight: '700' }}>{config.name}</h3>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: agent?.enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                        color: agent?.enabled ? '#10b981' : '#9ca3af',
                      }}
                    >
                      {agent?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', color: '#9ca3af', fontSize: '12px' }}>Completed</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: '700', color: '#10b981' }}>{completed}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', color: '#9ca3af', fontSize: '12px' }}>Processing</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>{processing}</p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', color: '#9ca3af', fontSize: '12px' }}>Failed</p>
                      <p style={{ margin: '0', fontSize: '20px', fontWeight: '700', color: '#ef4444' }}>{failed}</p>
                    </div>
                  </div>

                  <p style={{ margin: '0', color: '#6b7280', fontSize: '12px' }}>
                    Last execution: {agent?.last_execution_at ? formatDate(agent.last_execution_at) : 'Never'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Tasks Table */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={24} /> Recent Tasks
          </h2>
          <div style={{ background: '#1f2937', borderRadius: '12px', overflow: 'hidden', border: '1px solid #374151' }}>
            {sortedTasks.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af' }}>
                <AlertCircle size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No tasks yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr style={{ background: '#0f172a' }}>
                      <th onClick={() => setSortConfig({ key: 'id', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Task ID {sortConfig.key === 'id' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Agent</th>
                      <th>Task Type</th>
                      <th onClick={() => setSortConfig({ key: 'status', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                      <th>Duration</th>
                      <th>Tokens</th>
                      <th onClick={() => setSortConfig({ key: 'created_at', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                        Created {sortConfig.key === 'created_at' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.map((task, idx) => {
                      const agentConfig = AGENT_TYPES[task.agent_type as keyof typeof AGENT_TYPES];
                      const statusConfig = STATUS_COLORS[task.status as keyof typeof STATUS_COLORS];
                      return (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#d1d5db' }}>
                            {task.id?.slice(0, 8)}...
                          </td>
                          <td>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: agentConfig?.bgColor,
                                color: agentConfig?.color,
                              }}
                            >
                              {agentConfig?.name}
                            </span>
                          </td>
                          <td style={{ fontSize: '13px' }}>{task.task_type || '-'}</td>
                          <td>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                background: statusConfig?.bg,
                                color: statusConfig?.color,
                              }}
                            >
                              {task.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '13px', color: '#9ca3af' }}>
                            {formatDuration(task.duration_seconds)}
                          </td>
                          <td style={{ fontSize: '13px', fontWeight: '600' }}>
                            {formatNumber(task.tokens_used || 0)}
                          </td>
                          <td style={{ fontSize: '13px', color: '#9ca3af' }}>
                            {formatDate(task.created_at)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Quota Usage */}
        {data?.quota && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Quota Usage</h2>
            <div style={{ display: 'grid', gap: '20px' }}>
              {[
                { label: 'Tasks', used: data.quota.tasks_used || 0, limit: data.quota.tasks_limit || 1000 },
                { label: 'Tokens', used: data.quota.tokens_used || 0, limit: data.quota.tokens_limit || 1000000 },
                { label: 'Emails', used: data.quota.emails_sent || 0, limit: data.quota.emails_limit || 100 },
              ].map((q, idx) => {
                const percent = (q.used / q.limit) * 100;
                return (
                  <div key={idx} style={{ background: '#1f2937', padding: '16px', borderRadius: '12px', border: '1px solid #374151' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <p style={{ margin: '0', fontWeight: '600' }}>{q.label}</p>
                      <p style={{ margin: '0', color: '#9ca3af', fontSize: '13px' }}>
                        {formatNumber(q.used)} / {formatNumber(q.limit)}
                      </p>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(percent, 100)}%`,
                          background: percent > 80 ? '#ef4444' : percent > 50 ? '#f59e0b' : '#3b82f6',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <p style={{ margin: '8px 0 0 0', color: '#6b7280', fontSize: '12px' }}>
                      {percent.toFixed(0)}% used
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Email Summarize', icon: Mail, color: '#3b82f6' },
              { label: 'Review Response', icon: CheckCircle, color: '#10b981' },
              { label: 'Lead Scrape', icon: TrendingUp, color: '#f59e0b' },
              { label: 'Connect Gmail', icon: Mail, color: '#8b5cf6' },
            ].map((action, idx) => (
              <button
                key={idx}
                onClick={() => console.log(`Triggered: ${action.label}`)}
                style={{
                  padding: '16px',
                  background: '#1f2937',
                  border: `1px solid ${action.color}40`,
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = action.color + '20';
                  e.currentTarget.style.borderColor = action.color;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#1f2937';
                  e.currentTarget.style.borderColor = action.color + '40';
                }}
              >
                <action.icon size={18} />
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Integrations Status */}
        {data?.integrations && data.integrations.length > 0 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>Connected Integrations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
              {data.integrations.map((integration, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#1f2937',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #374151',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>{integration.type}</p>
                    <p style={{ margin: '0', color: '#9ca3af', fontSize: '12px' }}>
                      Last sync: {integration.last_synced_at ? formatDate(integration.last_synced_at) : 'Never'}
                    </p>
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: integration.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: integration.status === 'ACTIVE' ? '#10b981' : '#9ca3af',
                    }}
                  >
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
