/** Minimal Mailpit HTTP API client for web e2e (same shape as apps/api/test/support/mailpit.ts). */
export class MailpitClient {
  constructor(private readonly baseUrl: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, init);
    if (!res.ok) throw new Error(`Mailpit ${init?.method ?? 'GET'} ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  /** Messages addressed to `address`, oldest first. */
  async messagesTo(address: string): Promise<{ ID: string; Subject: string }[]> {
    const found = await this.call<{ messages: { ID: string; Subject: string }[] }>(
      `/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`,
    );
    return [...found.messages].reverse();
  }

  async text(id: string): Promise<{ text: string; html: string }> {
    const message = await this.call<{ Text: string; HTML: string }>(`/message/${id}`);
    return { text: message.Text, html: message.HTML };
  }

  /** Polls until `count` messages for `address` arrived (the API sends in the background). */
  async waitFor(address: string, count = 1, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const messages = await this.messagesTo(address);
      if (messages.length >= count) return messages;
      if (Date.now() > deadline) {
        throw new Error(`expected ${count} email(s) to ${address}, found ${messages.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  async deleteFor(address: string): Promise<void> {
    const path = `/search?query=${encodeURIComponent(`to:"${address}"`)}`;
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Mailpit DELETE ${path} -> ${res.status}`);
  }

  /**
   * Polls Mailpit until any message to `address` contains an http(s) link whose path includes
   * `pathFragment` (e.g. `verify-email` or `reset-password`). Scans newest first so a late
   * verification email does not steal a reset-password wait.
   */
  async waitForLink(address: string, pathFragment: string, timeoutMs = 20_000): Promise<string> {
    const linkPattern = new RegExp(`https?://[^\\s"'<>]+${pathFragment}[^\\s"'<>]*`);
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const messages = await this.messagesTo(address);
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!message) {
          continue;
        }
        const { text, html } = await this.text(message.ID);
        const match = linkPattern.exec(`${text}\n${html}`);
        if (match?.[0]) {
          return match[0].replaceAll('&amp;', '&');
        }
      }
      if (Date.now() > deadline) {
        throw new Error(`no ${pathFragment} link in email to ${address} within ${timeoutMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}
