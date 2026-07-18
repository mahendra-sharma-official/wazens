const STAMP_TEXT = {
  0: "PLANNED",
  1: "ONGOING",
  2: "COMPLETED",
  3: "CANCELLED",
};

const STAMP_CLASS = {
  0: "stamp-pending",
  1: "stamp-pending",
  2: "stamp-verified",
  3: "stamp-cancelled",
};

// The one deliberately "designed" element in the app: an ink stamp
// marking a project's status, the way a case file would be stamped
// in a government registry.
export function StatusStamp({ status }) {
  const label = STAMP_TEXT[status] ?? "UNKNOWN";
  const cls = STAMP_CLASS[status] ?? "stamp-pending";
  return <span className={`stamp ${cls}`}>{label}</span>;
}
