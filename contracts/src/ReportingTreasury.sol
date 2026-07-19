// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ProjectLedger.sol";

/// @title ReportingTreasury
/// @notice A dedicated, publicly inspectable pool of ETH set aside for
///         exactly one purpose: reimbursing whoever relays a citizen's
///         signed report on their behalf, so an ordinary member of the
///         public never needs their own gas to participate in the
///         transparency ledger. The flow:
///
///         1. A citizen signs an EIP-712 "CitizenReport" message with
///            their wallet. This costs no gas and sends no
///            transaction, MetaMask just shows a signature request.
///         2. That signature, together with the report content, is
///            handed to a relayer (see relayer/ in this repo for a
///            small local one). Anyone can run a relayer, it does not
///            need to be trusted with anything beyond gas money.
///         3. The relayer calls sponsorReport, paying gas for the
///            actual transaction out of their own balance up front.
///         4. This contract calls into ProjectLedger to verify the
///            signature and record the report under the citizen's own
///            address (not the relayer's), then reimburses the
///            relayer's gas cost from its own ETH balance.
///
///         Every top-up, every reimbursement, and the running balance
///         are all just normal ETH transfers and public contract
///         state, so "how much has the government spent sponsoring
///         citizen participation" is always visible on chain.
contract ReportingTreasury {
    ProjectLedger public immutable ledger;

    uint256 public totalSponsored;
    uint256 public reportsSponsoredCount;

    /// @dev Small buffer added on top of measured gas, covering the
    ///      base transaction cost (21000 gas) and the cost of this
    ///      wrapper call itself, which gasleft() accounting inside the
    ///      call cannot see.
    uint256 public constant GAS_OVERHEAD = 45000;

    event Funded(address indexed from, uint256 amount);
    event ReportSponsored(
        uint256 indexed projectId, uint256 indexed reportIndex, address indexed reporter, address relayer, uint256 refund
    );

    constructor(address ledgerAddress) {
        require(ledgerAddress != address(0), "ReportingTreasury: zero ledger address");
        ledger = ProjectLedger(ledgerAddress);
    }

    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    function fund() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /// @notice Anyone can call this, it is the relayer's own signed
    ///         Ethereum transaction, so they're already paying gas for
    ///         it out of pocket. What makes this a "sponsored" report
    ///         is that this contract pays that gas back to them
    ///         immediately afterward.
    function sponsorReport(address reporter, uint256 projectId, string calldata comment, bytes calldata signature)
        external
        returns (uint256 reportIndex)
    {
        uint256 startGas = gasleft();

        reportIndex = ledger.fileCitizenReportBySignature(reporter, projectId, comment, signature);

        uint256 gasUsed = startGas - gasleft() + GAS_OVERHEAD;
        uint256 refund = gasUsed * tx.gasprice;
        if (refund > address(this).balance) {
            refund = address(this).balance;
        }

        totalSponsored += refund;
        reportsSponsoredCount += 1;

        if (refund > 0) {
            (bool sent,) = payable(msg.sender).call{value: refund}("");
            require(sent, "ReportingTreasury: refund transfer failed");
        }

        emit ReportSponsored(projectId, reportIndex, reporter, msg.sender, refund);
    }
}
