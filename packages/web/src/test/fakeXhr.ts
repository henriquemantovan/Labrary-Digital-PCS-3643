import { act } from "@testing-library/react";

/** XMLHttpRequest controlado pelo teste: progresso, resposta, falha e cancelamento. */
export class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: {
    onprogress: ((event: Partial<ProgressEvent>) => void) | null;
  } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  method = "";
  url = "";
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = "";
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: FormData) {
    this.body = body;
    FakeXHR.instances.push(this);
  }
  abort() {
    this.onabort?.();
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    act(() => this.upload.onprogress?.({ lengthComputable, loaded, total }));
  }
  async respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === "string" ? body : JSON.stringify(body);
    await act(async () => this.onload?.());
  }
  async fail() {
    await act(async () => this.onerror?.());
  }
}
