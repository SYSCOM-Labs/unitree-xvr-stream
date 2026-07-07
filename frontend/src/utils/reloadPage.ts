/** Hard reload — works on Go2 HTTP/IP (non-secure context). */
export function reloadPage(): void {
  const target = `${window.location.origin}/?_=${Date.now()}`
  window.location.href = target
}
