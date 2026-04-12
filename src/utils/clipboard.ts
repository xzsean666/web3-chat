export async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return 'copied' as const
    } catch {
      // Fall through to legacy copy path.
    }
  }

  if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', 'true')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'

    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, value.length)

    try {
      if (document.execCommand('copy')) {
        return 'copied' as const
      }
    } finally {
      document.body.removeChild(textarea)
    }
  }

  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('浏览器阻止了自动复制，请手动复制下面的邀请链接：', value)
    return 'prompted' as const
  }

  return 'failed' as const
}
