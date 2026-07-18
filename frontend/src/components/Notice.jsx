export function Notice({ status, message }) {
  if (!message || status === "idle") return null;
  return <p className={`notice notice-${status}`}>{message}</p>;
}
