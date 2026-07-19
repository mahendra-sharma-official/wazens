// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ProjectLedger.sol";

// Creating the reporting treasury/ Database contract (Class)
contract ReportingTreasury {
    // Declaring a public immutable ledger of type ProjectLedger contract.
    ProjectLedger public immutable ledger;

    // Declaring necessary variables for tracking records of sponsored reports.
    uint256 public totalSponsored;
    uint256 public reportsSponsoredCount;

    // max reporting time between two reports from the same acc.
    uint256 public constant REPORT_COOLDOWN = 1 hours;

    // max sponsorship that a reporter can receive.
    uint256 public constant MAX_SPONSORED_PER_REPORTER = 0.02 ether;

    // last sponsored time (to check if it's lower than REPORT_COOLDOWN)
    mapping(address => uint256) public lastSponsoredReportAt;

    // Total sponsorship received by the reporter.
    mapping(address => uint256) public sponsoredAmountByReporter;

    // extra gas buffer to account for tx overhead and wrapper call costs.
    uint256 public constant GAS_OVERHEAD = 45000;

    // events that get emitted on fulfillment of certain conditions (defined within functions).
    event Funded(address indexed from, uint256 amount);

    event ReportSponsored(
        uint256 indexed projectId,
        uint256 indexed reportIndex,
        address indexed reporter,
        address relayer,
        uint256 refund
    );

    // emitted when a reporter attempts to submit during cooldown.
    event ReporterCooldownTriggered(
        address indexed reporter,
        uint256 nextEligibleTime
    );

    // emitted when a reporter reaches the sponsorship cap.
    event ReporterSponsorCapReached(
        address indexed reporter,
        uint256 totalSponsored
    );

    // the actual constructor class for ReportingTreasury contract.
    constructor(address ledgerAddress) {
        require(
            ledgerAddress != address(0),
            "ReportingTreasury: zero ledger address"
        );

        // also initializing the project ledger with the address passed.
        ledger = ProjectLedger(ledgerAddress);
    }

    // can receive payments as it is declared as payable.
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    // smth similar to the above one.
    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    // files the report and refunds the relayer for gas spent.
    function sponsorReport(
        address reporter,
        uint256 projectId,
        string calldata comment,
        bytes calldata signature
    ) external returns (uint256 reportIndex) {
        // fetching the last sponsored report time for this reporter.
        uint256 lastReport = lastSponsoredReportAt[reporter];

        // checking if the reporter is still on cooldown.
        require(
            block.timestamp >= lastReport + REPORT_COOLDOWN,
            "ReportingTreasury: reporter cooldown active"
        );

        // storing gas left before the report is filed.
        uint256 startGas = gasleft();

        // forwarding the signed report to the ledger.
        reportIndex = ledger.fileCitizenReportBySignature(
            reporter,
            projectId,
            comment,
            signature
        );

        // updating the last sponsored report timestamp.
        lastSponsoredReportAt[reporter] = block.timestamp;

        // calculating gas consumed by this operation.
        uint256 gasUsed = startGas - gasleft() + GAS_OVERHEAD;

        // calculating refund amount based on gas used.
        uint256 refund = gasUsed * tx.gasprice;

        // checking how much sponsorship allowance is left.
        uint256 remainingAllowance = MAX_SPONSORED_PER_REPORTER -
            sponsoredAmountByReporter[reporter];

        // ensuring refund does not exceed reporter's sponsorship cap.
        if (refund > remainingAllowance) {
            refund = remainingAllowance;
        }

        // ensuring refund does not exceed treasury balance.
        if (refund > address(this).balance) {
            refund = address(this).balance;
        }

        // updating treasury statistics.
        totalSponsored += refund;
        reportsSponsoredCount += 1;

        // updating total sponsorship received by the reporter.
        sponsoredAmountByReporter[reporter] += refund;

        // sending refund to the relayer if any amount is due.
        if (refund > 0) {
            (bool sent, ) = payable(msg.sender).call{value: refund}("");
            require(sent, "ReportingTreasury: refund transfer failed");
        }

        // emitting event for the sponsored report.
        emit ReportSponsored(
            projectId,
            reportIndex,
            reporter,
            msg.sender,
            refund
        );
    }
}