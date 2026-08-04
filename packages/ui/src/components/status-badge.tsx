import * as React from 'react'
import { cn } from '../lib/utils'

type JobStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

const jobStatusConfig: Record<JobStatus, {
  label: string; dotStyle: React.CSSProperties; style: React.CSSProperties; animate?: boolean
}> = {
  pending: {
    label: '未開始',
    dotStyle: { background: 'oklch(0.42 0.007 75)' },
    style: { background: 'oklch(0.42 0.007 75/0.10)', color: 'oklch(0.60 0.010 75)', border: '1px solid oklch(0.42 0.007 75/0.25)' },
  },
  in_progress: {
    label: '作業中',
    dotStyle: { background: 'oklch(0.73 0.12 78)', boxShadow: '0 0 6px oklch(0.73 0.12 78 / 0.8)' },
    style: { background: 'oklch(0.73 0.12 78/0.10)', color: 'oklch(0.82 0.13 78)', border: '1px solid oklch(0.73 0.12 78/0.40)', boxShadow: '0 0 8px oklch(0.73 0.12 78/0.15)' },
    animate: true,
  },
  completed: {
    label: '完了',
    dotStyle: { background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150/0.6)' },
    style: { background: 'oklch(0.72 0.18 150/0.10)', color: 'oklch(0.72 0.18 150)', border: '1px solid oklch(0.72 0.18 150/0.40)', boxShadow: '0 0 8px oklch(0.72 0.18 150/0.15)' },
  },
  cancelled: {
    label: 'キャンセル',
    dotStyle: { background: 'oklch(0.65 0.25 27)' },
    style: { background: 'oklch(0.65 0.25 27/0.10)', color: 'oklch(0.65 0.25 27)', border: '1px solid oklch(0.65 0.25 27/0.35)' },
  },
}

const projectStatusConfig: Record<ProjectStatus, {
  label: string; dotStyle: React.CSSProperties; style: React.CSSProperties; animate?: boolean
}> = {
  active: {
    label: '稼働中',
    dotStyle: { background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150/0.7)' },
    style: { background: 'oklch(0.72 0.18 150/0.10)', color: 'oklch(0.72 0.18 150)', border: '1px solid oklch(0.72 0.18 150/0.40)', boxShadow: '0 0 8px oklch(0.72 0.18 150/0.15)' },
    animate: true,
  },
  paused: {
    label: '停止中',
    dotStyle: { background: 'oklch(0.73 0.12 78)' },
    style: { background: 'oklch(0.73 0.12 78/0.10)', color: 'oklch(0.82 0.13 78)', border: '1px solid oklch(0.73 0.12 78/0.30)' },
  },
  completed: {
    label: '完了',
    dotStyle: { background: 'oklch(0.42 0.007 75)' },
    style: { background: 'oklch(0.42 0.007 75/0.10)', color: 'oklch(0.60 0.010 75)', border: '1px solid oklch(0.42 0.007 75/0.25)' },
  },
  cancelled: {
    label: 'キャンセル',
    dotStyle: { background: 'oklch(0.65 0.25 27)' },
    style: { background: 'oklch(0.65 0.25 27/0.10)', color: 'oklch(0.65 0.25 27)', border: '1px solid oklch(0.65 0.25 27/0.35)' },
  },
}

interface StatusBadgeProps {
  status: JobStatus | ProjectStatus
  type?: 'job' | 'project'
  className?: string
}

function StatusBadge({ status, type = 'job', className }: StatusBadgeProps) {
  const config = type === 'job'
    ? jobStatusConfig[status as JobStatus]
    : projectStatusConfig[status as ProjectStatus]

  if (!config) return null

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-medium', className)}
      style={config.style}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full shrink-0', config.animate && 'animate-[pulse-soft_1.5s_ease-in-out_infinite]')}
        style={config.dotStyle}
      />
      {config.label}
    </span>
  )
}

export { StatusBadge, type JobStatus, type ProjectStatus }
