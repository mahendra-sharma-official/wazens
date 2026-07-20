// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IGovRegistry.sol";

// Contract for managing public procurement tenders.
contract Tender {
    // different statuses that a tender can be in.
    enum TenderStatus {
        Open,
        Closed,
        Awarded,
        Cancelled
    }

    // structure for storing tender information.
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

    // structure for storing bid information.
    struct Bid {
        address bidder;
        uint256 amount;
        string proposal;
        uint256 timestamp;
    }

    // registry contract for checking roles and permissions.
    IGovRegistry public immutable registry;

    // counter for generating tender ids.
    uint256 private _tenderCounter;

    // stores tenders by their id.
    mapping(uint256 => TenderInfo) private _tenders;

    // stores bids for each tender.
    mapping(uint256 => Bid[]) private _bids;

    // stores tender ids grouped by department.
    mapping(uint256 => uint256[]) private _departmentTenderIds;

    // events emitted whenever tender data changes.
    event TenderCreated(
        uint256 indexed tenderId,
        uint256 indexed departmentId,
        address indexed createdBy,
        string title,
        uint256 estimatedBudget,
        uint256 submissionDeadline
    );

    event BidSubmitted(
        uint256 indexed tenderId,
        address indexed bidder,
        uint256 bidIndex,
        uint256 amount
    );

    event BiddingClosed(
        uint256 indexed tenderId,
        address indexed closedBy
    );

    event TenderAwarded(
        uint256 indexed tenderId,
        address indexed winner,
        address indexed awardedBy,
        uint256 bidIndex,
        uint256 amount
    );

    event TenderCancelled(
        uint256 indexed tenderId,
        address indexed cancelledBy
    );

    // constructor for the Tender contract.
    constructor(address registryAddress) {
        require(
            registryAddress != address(0),
            "Tender: zero registry address"
        );

        // initializing the registry contract.
        registry = IGovRegistry(registryAddress);
    }

    // ensures caller is authorized for the given department.
    modifier onlyAuthorized(uint256 departmentId) {
        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                departmentId
            ),
            "Tender: not authorized for department"
        );
        _;
    }

    // ensures the tender exists before continuing.
    modifier tenderExists(uint256 tenderId) {
        require(
            _tenders[tenderId].createdAt != 0,
            "Tender: does not exist"
        );
        _;
    }

    function createTender(
        uint256 departmentId,
        uint256 relatedProjectId,
        string calldata title,
        string calldata description,
        uint256 estimatedBudget,
        uint256 submissionDeadline
    )
        external
        onlyAuthorized(departmentId)
        returns (uint256 tenderId)
    {
        require(
            registry.departmentExists(departmentId),
            "Tender: department does not exist"
        );

        require(
            submissionDeadline > block.timestamp,
            "Tender: deadline must be in the future"
        );

        // generating a new tender id.
        _tenderCounter += 1;
        tenderId = _tenderCounter;

        // creating and storing the tender.
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

        // adding the tender to its department list.
        _departmentTenderIds[departmentId].push(tenderId);

        emit TenderCreated(
            tenderId,
            departmentId,
            msg.sender,
            title,
            estimatedBudget,
            submissionDeadline
        );
    }

    // allows anyone to submit a bid for an open tender.
    function submitBid(
        uint256 tenderId,
        uint256 amount,
        string calldata proposal
    )
        external
        tenderExists(tenderId)
        returns (uint256 bidIndex)
    {
        // fetching the tender.
        TenderInfo storage t = _tenders[tenderId];

        require(
            t.status == TenderStatus.Open,
            "Tender: not open for bidding"
        );

        require(
            block.timestamp <= t.submissionDeadline,
            "Tender: submission deadline has passed"
        );

        require(
            amount > 0,
            "Tender: amount must be positive"
        );

        // creating and storing the bid.
        _bids[tenderId].push(
            Bid({
                bidder: msg.sender,
                amount: amount,
                proposal: proposal,
                timestamp: block.timestamp
            })
        );

        bidIndex = _bids[tenderId].length - 1;

        emit BidSubmitted(
            tenderId,
            msg.sender,
            bidIndex,
            amount
        );
    }

    function closeBidding(
        uint256 tenderId
    ) external tenderExists(tenderId) {
        // fetching the tender.
        TenderInfo storage t = _tenders[tenderId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                t.departmentId
            ),
            "Tender: not authorized for department"
        );

        require(
            t.status == TenderStatus.Open,
            "Tender: bidding is not open"
        );

        // updating tender status to closed.
        t.status = TenderStatus.Closed;

        emit BiddingClosed(
            tenderId,
            msg.sender
        );
    }

    // awards a tender to one of the submitted bids.
    function awardTender(
        uint256 tenderId,
        uint256 bidIndex
    ) external tenderExists(tenderId) {
        // fetching the tender.
        TenderInfo storage t = _tenders[tenderId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                t.departmentId
            ),
            "Tender: not authorized for department"
        );

        require(
            t.status == TenderStatus.Closed,
            "Tender: close bidding before awarding"
        );

        require(
            bidIndex < _bids[tenderId].length,
            "Tender: invalid bid index"
        );

        // fetching the winning bid.
        Bid storage winningBid =
            _bids[tenderId][bidIndex];

        // storing award information.
        t.status = TenderStatus.Awarded;
        t.awardedBidIndex = bidIndex;
        t.awardedBidder = winningBid.bidder;
        t.awardedAmount = winningBid.amount;

        emit TenderAwarded(
            tenderId,
            winningBid.bidder,
            msg.sender,
            bidIndex,
            winningBid.amount
        );
    }

    function cancelTender(
        uint256 tenderId
    ) external tenderExists(tenderId) {
        // fetching the tender.
        TenderInfo storage t = _tenders[tenderId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                t.departmentId
            ),
            "Tender: not authorized for department"
        );

        require(
            t.status == TenderStatus.Open ||
                t.status == TenderStatus.Closed,
            "Tender: cannot cancel from this state"
        );

        // updating tender status to cancelled.
        t.status = TenderStatus.Cancelled;

        emit TenderCancelled(
            tenderId,
            msg.sender
        );
    }

    // public view functions.

    function getTender(
        uint256 tenderId
    ) external view returns (TenderInfo memory) {
        require(
            _tenders[tenderId].createdAt != 0,
            "Tender: does not exist"
        );

        return _tenders[tenderId];
    }

    function getTenderCount()
        external
        view
        returns (uint256)
    {
        return _tenderCounter;
    }

    function getBids(
        uint256 tenderId
    ) external view returns (Bid[] memory) {
        return _bids[tenderId];
    }

    function getDepartmentTenderIds(
        uint256 departmentId
    ) external view returns (uint256[] memory) {
        return _departmentTenderIds[departmentId];
    }
}