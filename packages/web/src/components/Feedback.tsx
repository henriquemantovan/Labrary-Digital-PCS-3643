import { Icon } from "../Icons";

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice" role="alert">
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Carregando seu espaço…
    </div>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="folder" size={28} />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
