import { useState } from 'react'

interface Props {
  code: string
  originalQuery?: string
}

export function DqlCodeBlock({ code, originalQuery }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const timestamp = new Date().toLocaleString()
    const header = originalQuery
      ? `# BLOO Copilot — ${originalQuery}\n# Generated: ${timestamp}\n`
      : `# BLOO Copilot — Generated: ${timestamp}\n`
    navigator.clipboard.writeText(header + code.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="dql-block">
      <div className="dql-header">
        <span className="dql-label">DQL</span>
        <button className="dql-copy" onClick={handleCopy}>
          {copied ? '✓ Copied!' : '📋 Copy'}
        </button>
      </div>
      <pre className="dql-code"><code>{code.trim()}</code></pre>
    </div>
  )
}
