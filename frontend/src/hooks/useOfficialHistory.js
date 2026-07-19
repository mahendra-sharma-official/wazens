import { useEffect, useState } from "react";
import { formatEther } from "ethers";
import { getReadRegistry, getReadLedger, getReadTender, getReadProvider } from "../lib/contracts.js";

/// Builds an address's public activity history directly from on-chain
/// event logs, the same way a block explorer would, rather than
/// keeping a separate off-chain index. Every event this project emits
/// that names an official (as responsibleOfficial, recordedBy,
/// completedBy, createdBy, awardedBy, etc.) was deliberately indexed
/// for exactly this purpose, see the "Architecture" notes in the
/// contracts for which fields are indexed and why.
export function useOfficialHistory(address) {
  const [entries, setEntries] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const registry = getReadRegistry();
      const ledger = getReadLedger();
      const tender = getReadTender();

      const queries = [
        [registry, "DepartmentCreated", registry.filters.DepartmentCreated(null, address), () => ({
          type: "department",
          label: `Registered as head of a new department`,
        })],
        [registry, "DepartmentCreated", registry.filters.DepartmentCreated(null, null, address), (log) => ({
          type: "department",
          label: `Created a new department: "${log.args.name}"`,
        })],
        [registry, "OfficialAdded", registry.filters.OfficialAdded(address), () => ({
          type: "official",
          label: `Added as an official`,
        })],
        [registry, "OfficialDeactivated", registry.filters.OfficialDeactivated(address), () => ({
          type: "official",
          label: `Removed as an official`,
        })],
        [registry, "OfficialAdded", registry.filters.OfficialAdded(null, null, address), (log) => ({
          type: "official",
          label: `Added "${log.args.name}" as an official`,
        })],
        [registry, "OfficialDeactivated", registry.filters.OfficialDeactivated(null, null, address), () => ({
          type: "official",
          label: `Removed an official's access`,
        })],
        [ledger, "ProjectCreated", ledger.filters.ProjectCreated(null, null, address), (log) => ({
          type: "project",
          label: `Made responsible for project "${log.args.name}"`,
          projectId: Number(log.args.projectId),
        })],
        [ledger, "ResponsibleOfficialChanged", ledger.filters.ResponsibleOfficialChanged(null, null, address), (log) => ({
          type: "project",
          label: `Reassigned as the responsible official`,
          projectId: Number(log.args.projectId),
        })],
        [ledger, "MilestoneAdded", ledger.filters.MilestoneAdded(null, address), (log) => ({
          type: "milestone",
          label: `Added milestone "${log.args.description}"`,
          projectId: Number(log.args.projectId),
        })],
        [ledger, "MilestoneCompleted", ledger.filters.MilestoneCompleted(null, address), (log) => ({
          type: "milestone",
          label: `Marked a milestone complete`,
          projectId: Number(log.args.projectId),
        })],
        [ledger, "SpendingRecorded", ledger.filters.SpendingRecorded(null, null, address), (log) => ({
          type: "spending",
          label: `Recorded ${formatEther(log.args.amount)} spending: ${log.args.purpose}`,
          projectId: Number(log.args.projectId),
          amount: log.args.amount,
        })],
        [ledger, "ProjectStatusChanged", ledger.filters.ProjectStatusChanged(null, address), (log) => ({
          type: "status",
          label: `Changed a project's status`,
          projectId: Number(log.args.projectId),
        })],
        [ledger, "ReportStatusChanged", ledger.filters.ReportStatusChanged(null, address), (log) => ({
          type: "report",
          label: `Triaged a citizen report`,
          projectId: Number(log.args.projectId),
        })],
        [tender, "TenderCreated", tender.filters.TenderCreated(null, null, address), (log) => ({
          type: "tender",
          label: `Published tender "${log.args.title}"`,
          tenderId: Number(log.args.tenderId),
        })],
        [tender, "BiddingClosed", tender.filters.BiddingClosed(null, address), (log) => ({
          type: "tender",
          label: `Closed bidding on a tender`,
          tenderId: Number(log.args.tenderId),
        })],
        [tender, "TenderCancelled", tender.filters.TenderCancelled(null, address), (log) => ({
          type: "tender",
          label: `Cancelled a tender`,
          tenderId: Number(log.args.tenderId),
        })],
        [tender, "TenderAwarded", tender.filters.TenderAwarded(null, null, address), (log) => ({
          type: "tender",
          label: `Awarded a tender (${formatEther(log.args.amount)})`,
          tenderId: Number(log.args.tenderId),
        })],
        [tender, "TenderAwarded", tender.filters.TenderAwarded(null, address), (log) => ({
          type: "tender-won",
          label: `Won a tender bid (${formatEther(log.args.amount)})`,
          tenderId: Number(log.args.tenderId),
        })],
      ];

      const results = await Promise.all(
        queries.map(async ([contract, , filter, describe]) => {
          const logs = await contract.queryFilter(filter, 0, "latest");
          return logs.map((log) => ({ log, describe }));
        })
      );

      const flat = results.flat();

      const uniqueBlocks = [...new Set(flat.map(({ log }) => log.blockNumber))];
      const blocks = await Promise.all(uniqueBlocks.map((bn) => getReadProviderBlock(bn)));
      const blockTimestamps = Object.fromEntries(uniqueBlocks.map((bn, i) => [bn, blocks[i]]));

      const items = flat.map(({ log, describe }) => {
        const described = describe(log);
        return {
          ...described,
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
          timestamp: blockTimestamps[log.blockNumber],
        };
      });

      items.sort((a, b) => b.blockNumber - a.blockNumber);

      // Aggregate stats, computed from the same logs rather than a
      // second round of contract reads.
      const spendingLogs = items.filter((i) => i.type === "spending");
      const totalRecorded = spendingLogs.reduce((sum, i) => sum + i.amount, 0n);

      if (!cancelled) {
        setEntries(items);
        setStats({
          projectsResponsibleFor: new Set(items.filter((i) => i.type === "project").map((i) => i.projectId)).size,
          milestonesCompleted: items.filter((i) => i.label?.startsWith("Marked a milestone")).length,
          totalSpendingRecorded: totalRecorded,
          reportsTriaged: items.filter((i) => i.type === "report").length,
          tendersPublished: items.filter((i) => i.type === "tender").length,
          tendersWon: items.filter((i) => i.type === "tender-won").length,
        });
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { entries, stats, loading };
}

async function getReadProviderBlock(blockNumber) {
  const block = await getReadProvider().getBlock(blockNumber);
  return block ? block.timestamp : 0;
}
