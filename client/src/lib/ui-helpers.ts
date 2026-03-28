/**
 * UI Helper utilities
 */

import type { Alert, Sensor } from './types';

export function getSensorStateVariant(state: Sensor['current_state']) {
  switch (state) {
    case 'healthy':
      return 'default';
    case 'warning':
      return 'secondary';
    case 'critical':
      return 'destructive';
    case 'silent':
      return 'outline';
    default:
      return 'default';
  }
}

export function getAlertSeverityVariant(severity: Alert['severity']) {
  return severity === 'critical' ? 'destructive' : 'secondary';
}

export function getAlertStatusVariant(
  status: Alert['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'open':
      return 'destructive';
    case 'acknowledged':
      return 'secondary';
    case 'resolved':
      return 'default';
    default:
      return 'default';
  }
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function hoursAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours === 0) {
    const diffMins = Math.floor(diffMs / (1000 * 60));
    return `${diffMins}m ago`;
  }

  if (diffHours === 1) return '1h ago';
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getStatusEmoji(state: Sensor['current_state']): string {
  switch (state) {
    case 'healthy':
      return '✓';
    case 'warning':
      return '⚠';
    case 'critical':
      return '✕';
    case 'silent':
      return '○';
    default:
      return '?';
  }
}

/**
 * Parse time for suppression
 */
export function parseSuppressionTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
