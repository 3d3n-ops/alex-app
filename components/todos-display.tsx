'use client'

import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TodoItem {
	id: string
	content: string
	status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

interface TodosDisplayProps {
	todos: TodoItem[]
	className?: string
}

export function TodosDisplay({ todos, className }: TodosDisplayProps) {
	if (!todos || todos.length === 0) return null

	const getStatusIcon = (status: TodoItem['status']) => {
		switch (status) {
			case 'completed':
				return <CheckCircle2 className="size-4 text-green-500" />
			case 'in_progress':
				return <Loader2 className="size-4 text-blue-500 animate-spin" />
			case 'cancelled':
				return <XCircle className="size-4 text-gray-500" />
			case 'pending':
			default:
				return <Circle className="size-4 text-gray-400" />
		}
	}

	const getStatusText = (status: TodoItem['status']) => {
		switch (status) {
			case 'completed':
				return 'text-green-600 dark:text-green-400'
			case 'in_progress':
				return 'text-blue-600 dark:text-blue-400'
			case 'cancelled':
				return 'text-gray-500 line-through'
			case 'pending':
			default:
				return 'text-gray-600 dark:text-gray-400'
		}
	}

	return (
		<div className={cn('bg-muted/50 rounded-lg p-3 space-y-2 border border-border/50', className)}>
			<div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
				Action Plan
			</div>
			<div className="space-y-1.5">
				{todos.map((todo) => (
					<div
						key={todo.id}
						className={cn(
							'flex items-start gap-2 text-sm',
							todo.status === 'completed' && 'opacity-75',
							todo.status === 'cancelled' && 'opacity-50'
						)}
					>
						<div className="mt-0.5 shrink-0">
							{getStatusIcon(todo.status)}
						</div>
						<span className={cn('flex-1', getStatusText(todo.status))}>
							{todo.content}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}

