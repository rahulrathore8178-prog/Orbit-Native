// Module-level so the socket handler reads it at event time (no stale closures, no re-renders).
let activeChatId: string | null = null

export const setActiveChat = (id: string | null) => {
  activeChatId = id ? String(id) : null
}
export const getActiveChat = () => activeChatId