/** Minimal client for the Mailpit HTTP API (https://mailpit.axllent.org/docs/api-v1/). */
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

  async text(id: string): Promise<{ text: string; html: string; from: string }> {
    const message = await this.call<{ Text: string; HTML: string; From: { Address: string } }>(
      `/message/${id}`,
    );
    return { text: message.Text, html: message.HTML, from: message.From.Address };
  }

  /** Polls until `count` messages for `address` arrived (the API sends in the background). */
  async waitFor(address: string, count = 1, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const messages = await this.messagesTo(address);
      if (messages.length >= count) return messages;
      if (Date.now() > deadline) {
        throw new Error(`expected ${count} email(s) to ${address}, found ${messages.length}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async deleteFor(address: string): Promise<void> {
    const path = `/search?query=${encodeURIComponent(`to:"${address}"`)}`;
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Mailpit DELETE ${path} -> ${res.status}`);
  }
}
