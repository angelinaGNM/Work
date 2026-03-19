import { useAudioRecorder } from '../hooks/useAudioRecorder'

interface Props {
  onTranscribed: (text: string) => void
  disabled: boolean
}

export function MicButton({ onTranscribed, disabled }: Props) {
  const { isRecording, isTranscribing, startRecording, stopRecording, transcribe } =
    useAudioRecorder()

  const handleStart = () => {
    if (disabled || isTranscribing) return
    startRecording()
  }

  const handleStop = async () => {
    if (!isRecording) return
    const blob = await stopRecording()
    if (!blob) return
    const text = await transcribe(blob)
    if (text) onTranscribed(text)
  }

  let label = '🎙'
  let title = 'Hold to speak'
  if (isRecording) { label = '⏹'; title = 'Release to transcribe' }
  if (isTranscribing) { label = '…'; title = 'Transcribing…' }

  return (
    <button
      className={`mic-btn${isRecording ? ' mic-btn--recording' : ''}${isTranscribing ? ' mic-btn--transcribing' : ''}`}
      onMouseDown={handleStart}
      onMouseUp={handleStop}
      onMouseLeave={isRecording ? handleStop : undefined}
      onTouchStart={(e) => { e.preventDefault(); handleStart() }}
      onTouchEnd={(e) => { e.preventDefault(); handleStop() }}
      disabled={disabled && !isRecording}
      title={title}
      type="button"
    >
      {label}
    </button>
  )
}
