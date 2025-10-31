/**
 * Utilities for managing chat threads
 */

import { chatDb, type ChatThreadRow } from './chat-db'

/**
 * Get or create a thread entry
 */
export async function ensureThread(threadId: string, title?: string): Promise<ChatThreadRow> {
  let thread = await chatDb.threads.where('threadId').equals(threadId).first()
  
  if (!thread) {
    // Create new thread
    thread = {
      threadId,
      title: title || 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await chatDb.threads.add(thread)
  } else if (title && title !== thread.title) {
    // Update title if provided and different
    thread.title = title
    thread.updatedAt = Date.now()
    await chatDb.threads.update(thread.id!, {
      title,
      updatedAt: thread.updatedAt,
    })
  }
  
  return thread
}

/**
 * Update thread title
 */
export async function updateThreadTitle(threadId: string, title: string): Promise<void> {
  const thread = await chatDb.threads.where('threadId').equals(threadId).first()
  if (thread) {
    await chatDb.threads.update(thread.id!, {
      title,
      updatedAt: Date.now(),
    })
  } else {
    // Create if doesn't exist
    await ensureThread(threadId, title)
  }
}

/**
 * Get thread by ID
 */
export async function getThread(threadId: string): Promise<ChatThreadRow | undefined> {
  return await chatDb.threads.where('threadId').equals(threadId).first()
}

/**
 * Get all threads, sorted by updatedAt (most recent first)
 */
export async function getAllThreads(): Promise<ChatThreadRow[]> {
  return await chatDb.threads.orderBy('updatedAt').reverse().toArray()
}

/**
 * Delete a thread and all its messages
 */
export async function deleteThread(threadId: string): Promise<void> {
  // Delete messages
  await chatDb.messages.where('threadId').equals(threadId).delete()
  // Delete attachments
  await chatDb.attachments.where('threadId').equals(threadId).delete()
  // Delete thread
  await chatDb.threads.where('threadId').equals(threadId).delete()
}

/**
 * Get the first user message from a thread to use as title
 */
export async function getFirstUserMessage(threadId: string): Promise<string | null> {
  const firstMessage = await chatDb.messages
    .where('threadId')
    .equals(threadId)
    .and((m) => m.role === 'user')
    .sortBy('createdAt')
  
  if (firstMessage.length > 0) {
    // Use first 50 characters as title, truncate if longer
    const content = firstMessage[0].content
    return content.length > 50 ? content.substring(0, 47) + '...' : content
  }
  
  return null
}

