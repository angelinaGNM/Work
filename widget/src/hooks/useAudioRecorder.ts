import { useState, useRef, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      console.error('Microphone access denied or unavailable.')
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current
      if (!mediaRecorder || mediaRecorder.state === 'inactive') return resolve(null)

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        mediaRecorder.stream.getTracks().forEach((t) => t.stop())
        resolve(blob)
      }

      mediaRecorder.stop()
      setIsRecording(false)
    })
  }, [])

  const transcribe = useCallback(async (blob: Blob): Promise<string> => {
    setIsTranscribing(true)
    try {
      const form = new FormData()
      form.append('audio', blob, 'audio.webm')
      const res = await fetch(`${API_URL}/copilot/transcribe`, {
        method: 'POST',
        body: form,
      })
      const data = await res.json()
      return data.text ?? ''
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  return { isRecording, isTranscribing, startRecording, stopRecording, transcribe }
}
