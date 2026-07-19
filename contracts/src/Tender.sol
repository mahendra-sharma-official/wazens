// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IGovRegistry.sol";

/// @title Tender
/// @notice Public procurement register: a department opens a tender,
///         anyone (a company, a contractor, an individual) can submit
///         a bid against it with no wallet restriction, and an
///         official of that department closes bidding and awards it
///         to one of the submitted bids. Every bid and every decision
///         stays on chain and readable by anyone, so it is always
///         possible to see who bid what and who ultimately won a
///         government contract.
///
///         A tender can optionally reference a ProjectLedger project
///         id (`relatedProjectId`) purely as an informational link for
///         the frontend to cross reference, e.g. "this tender funded
///         milestone 2 of project #7". It is not validated against
///         ProjectLedger on chain, keeping the two contracts loosely
///         coupled the same way ProjectLedger itself only depends on
///         IGovRegistry.
contract Tender {
    enum TenderStatus {
        Open,
        Closed,
        Awarded,
        Cancelled
    }

    struct TenderInfo {
        uint256 id;
        uint256 departmentId;
        uint256 relatedProjectId;
        string title;
        string description;
        uint256 estimatedBudget;
        uint256 submissionDeadline;
        TenderStatus status;
        address createdBy;
        uint256 createdAt;
        uint256 awardedBidIndex;
        address awardedBidder;
        uint256 awardedAmount;
    }

    struct Bid {
        address bidder;
        uint256 amount;
        string proposal;
        uint256 timestamp;
    }

    IGovRegistry public immutable registry;

    uint256 private _tenderCounter;

    mapping(uint256 => TenderInfo) private _tenders;
    mapping(uint256 => Bid[]) private _bids;
    mapping(uint256 => uint256[]) private _departmentTenderIds;

    event TenderCreated(
        uint256 indexed tenderId, uint256 indexed departmentId, address indexed createdBy, string title, uint256 estimatedBudget, uint256 submissionDeadline
    );
    event BidSubmitted(uint256 indexed tenderId, address indexed bidder, uint256 bidIndex, uint256 amount);
    event BiddingClosed(uint256 indexed tenderId, address indexed closedBy);
    event TenderAwarded(uint256 indexed tenderId, address indexed winner, address indexed awardedBy, uint256 bidIndex, uint256 amount);
    event TenderCancelled(uint256 indexed tenderId, address indexed cancelledBy);

    constructor(address registryAddress) {
        require(registryAddress != address(0), "Tender: zero registry address");
        registry = IGovRegistry(registryAddress);
    }

    modifier onlyAuthorized(uint256 departmentId) {
        require(registry.isAuthorizedForDepartment(msg.sender, departmentId), "Tender: not authorized for department");
        _;
    }

    modifier tenderExists(uint256 tenderId) {
        require(_tenders[tenderId].createdAt != 0, "Tender: does not exist");
        _;
    }

    function createTender(
        uint256 departmentId,
        uint256 relatedProjectId,
        string calldata title,
        string calldata description,
        uint256 estimatedBudget,
        uint256 submissionDeadline
    ) external onlyAuthorized(departmentId) returns (uint256 tenderId) {
        require(registry.departmentExists(departmentId), "Tender: department does not exist");
        require(submissionDeadline > block.timestamp, "Tender: deadline must be in the future");

        _tenderCounter += 1;
        tenderId = _tenderCounter;

        _tenders[tenderId] = TenderInfo({
            id: tenderId,
            departmentId: departmentId,
            relatedProjectId: relatedProjectId,
            title: title,
            description: description,
            estimatedBudget: estimatedBudget,
            submissionDeadline: submissionDeadline,
            status: TenderStatus.Open,
            createdBy: msg.sender,
            createdAt: block.timestamp,
            awardedBidIndex: 0,
            awardedBidder: address(0),
            awardedAmount: 0
        });

        _departmentTenderIds[departmentId].push(tenderId);

        emit TenderCreated(tenderId, departmentId, msg.sender, title, estimatedBudget, submissionDeadline);
    }

    /// @notice Open to any wallet, no registry check at all, the same
    ///         way citizen reports work on ProjectLedger. A vendor
    ///         does not need to be a recognized official to bid.
    function submitBid(uint256 tenderId, uint256 amount, string calldata proposal)
        external
        tenderExists(tenderId)
        returns (uint256 bidIndex)
    {
        TenderInfo storage t = _tenders[tenderId];
        require(t.status == TenderStatus.Open, "Tender: not open for bidding");
        require(block.timestamp <= t.submissionDeadline, "Tender: submission deadline has passed");
        require(amount > 0, "Tender: amount must be positive");

        _bids[tenderId].push(Bid({bidder: msg.sender, amount: amount, proposal: proposal, timestamp: block.timestamp}));
        bidIndex = _bids[tenderId].length - 1;

        emit BidSubmitted(tenderId, msg.sender, bidIndex, amount);
    }

    function closeBidding(uint256 tenderId) external tenderExists(tenderId) {
        TenderInfo storage t = _tenders[tenderId];
        require(registry.isAuthorizedForDepartment(msg.sender, t.departmentId), "Tender: not authorized for department");
        require(t.status == TenderStatus.Open, "Tender: bidding is not open");

        t.status = TenderStatus.Closed;
        emit BiddingClosed(tenderId, msg.sender);
    }

    /// @notice Bidding must be closed first, so awarding is always a
    ///         deliberate two step process (close, then award) rather
    ///         than something that can happen while bids are still
    ///         coming in.
    function awardTender(uint256 tenderId, uint256 bidIndex) external tenderExists(tenderId) {
        TenderInfo storage t = _tenders[tenderId];
        require(registry.isAuthorizedForDepartment(msg.sender, t.departmentId), "Tender: not authorized for department");
        require(t.status == TenderStatus.Closed, "Tender: close bidding before awarding");
        require(bidIndex < _bids[tenderId].length, "Tender: invalid bid index");

        Bid storage winningBid = _bids[tenderId][bidIndex];

        t.status = TenderStatus.Awarded;
        t.awardedBidIndex = bidIndex;
        t.awardedBidder = winningBid.bidder;
        t.awardedAmount = winningBid.amount;

        emit TenderAwarded(tenderId, winningBid.bidder, msg.sender, bidIndex, winningBid.amount);
    }

    function cancelTender(uint256 tenderId) external tenderExists(tenderId) {
        TenderInfo storage t = _tenders[tenderId];
        require(registry.isAuthorizedForDepartment(msg.sender, t.departmentId), "Tender: not authorized for department");
        require(t.status == TenderStatus.Open || t.status == TenderStatus.Closed, "Tender: cannot cancel from this state");

        t.status = TenderStatus.Cancelled;
        emit TenderCancelled(tenderId, msg.sender);
    }

    // ---------------------------------------------------------------
    // Views: open to everyone, no restriction.
    // ---------------------------------------------------------------

    function getTender(uint256 tenderId) external view returns (TenderInfo memory) {
        require(_tenders[tenderId].createdAt != 0, "Tender: does not exist");
        return _tenders[tenderId];
    }

    function getTenderCount() external view returns (uint256) {
        return _tenderCounter;
    }

    function getBids(uint256 tenderId) external view returns (Bid[] memory) {
        return _bids[tenderId];
    }

    function getDepartmentTenderIds(uint256 departmentId) external view returns (uint256[] memory) {
        return _departmentTenderIds[departmentId];
    }
}
