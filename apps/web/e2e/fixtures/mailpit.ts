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
   * Waits for a new message and returns the first http(s) link whose path contains `pathFragment`
   * (e.g. `verify-email` or `reset-password`).
   */
  async waitForLink(address: string, pathFragment: string, minCount = 1): Promise<string> {
    const messages = await this.waitFor(address, minCount);
    const latest = messages[messages.length - 1];
    if (!latest) throw new Error(`no Mailpit message for ${address}`);
    const { text, html } = await this.text(latest.ID);
    const body = `${text}\n${html}`;
    const match = new RegExp(`https?://[^\\s"'<>]+${pathFragment}[^\\s"'<>]*`).exec(body);
    if (!match) {
      throw new Error(`no ${pathFragment} link in email to ${address}`);
    }
    return match[0].replaceAll('&amp;', '&');
  }
}
