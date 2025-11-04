import { z } from 'zod'

// Todo status enum
export const todoStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'cancelled'])

// Single todo item schema
export const todoItemSchema = z.object({
	id: z.string().describe('Unique identifier for the todo item'),
	content: z.string().describe('Description of the task'),
	status: todoStatusSchema.describe('Current status of the todo'),
})

// Schema for creating/updating todos
export const todosSchema = z.object({
	merge: z.boolean().describe('If true, merge with existing todos. If false, replace all todos.'),
	todos: z.array(todoItemSchema).describe('Array of todo items to create or update'),
})

export type TodoItem = z.infer<typeof todoItemSchema>
export type TodosInput = z.infer<typeof todosSchema>

// In-memory storage for todos per thread (in production, this could be persisted)
const todosStore = new Map<string, TodoItem[]>()

export async function todos(args: TodosInput, threadId?: string): Promise<{ todos: TodoItem[] }> {
	const key = threadId || 'default'
	
	if (args.merge) {
		// Merge: update existing todos by ID, add new ones
		const existing = todosStore.get(key) || []
		const existingMap = new Map(existing.map(t => [t.id, t]))
		
		// Update or add todos from input
		for (const todo of args.todos) {
			existingMap.set(todo.id, todo)
		}
		
		const merged = Array.from(existingMap.values())
		todosStore.set(key, merged)
		
		return { todos: merged }
	} else {
		// Replace: set todos to exactly what was provided
		todosStore.set(key, args.todos)
		return { todos: args.todos }
	}
}

// Helper to get current todos for a thread
export function getTodos(threadId?: string): TodoItem[] {
	const key = threadId || 'default'
	return todosStore.get(key) || []
}

