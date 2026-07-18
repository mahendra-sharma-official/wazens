const STAMP_TEXT = {
  0: "OPEN",
  1: "CLOSED",
  2: "AWARDED",
  3: "CANCELLED",
};

const STAMP_CLASS = {
  0: "stamp-pending",
  1: "stamp-closed",
  2: "stamp-verified",
  3: "stamp-cancelled",
};

// Same ink-stamp visual language as StatusStamp (used for projects),
// with its own status set: a tender's lifecycle is Open -> Closed ->
// Awarded, or Cancelled from either of the first two.
export function TenderStatusStamp({ status }) {
  const label = STAMP_TEXT[status] ?? "UNKNOWN";
  const cls = STAMP_CLASS[status] ?? "stamp-pending";
  return <span className={`stamp ${cls}`}>{label}</span>;
}
