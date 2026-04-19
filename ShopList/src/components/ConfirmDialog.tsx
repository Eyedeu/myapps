type Props = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="cd-title">
      <div className="confirm-card">
        <h2 id="cd-title">{title}</h2>
        <p>{message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn danger-solid' : 'btn primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
