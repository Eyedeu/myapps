type Props = {
  open: boolean
  message: string
}

export function AiQuestLoadingOverlay({ open, message }: Props) {
  if (!open) return null
  return (
    <div className="ai-quest-loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="ai-quest-loading-panel">
        <div className="ai-quest-loading-spinner" aria-hidden />
        <p className="ai-quest-loading-text">{message}</p>
      </div>
    </div>
  )
}
