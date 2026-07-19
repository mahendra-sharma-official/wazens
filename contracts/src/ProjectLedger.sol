// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IGovRegistry.sol";

/// @title ProjectLedger
/// @notice The public ledger of government projects. Anyone can read
///         every project, milestone and spending record. Writing is
///         restricted to officials/department heads recognized by
///         GovRegistry for that specific project's department, so
///         there is always a clear, on-chain trail of who is
///         responsible and who recorded what.
///
///         Citizen reports are the one exception: filing one never
///         requires the reporter to hold any ETH. `fileCitizenReport`
///         still works for anyone willing to pay their own gas, but
///         `fileCitizenReportBySignature` lets a citizen sign an
///         EIP-712 message (free, no transaction) and have any relayer
///         submit it on their behalf; see ReportingTreasury.sol for
///         the contract that reimburses that relayer's gas from a
///         dedicated, publicly inspectable government-funded balance.
contract ProjectLedger is EIP712 {
    enum ProjectStatus {
        Planned,
        Ongoing,
        Completed,
        Cancelled
    }

    struct Project {
        uint256 id;
        string name;
        string description;
        uint256 departmentId;
        address responsibleOfficial;
        uint256 allocatedBudget;
        uint256 spentBudget;
        ProjectStatus status;
        uint256 createdAt;
        address createdBy;
    }

    struct Milestone {
        string description;
        uint256 targetDate;
        bool completed;
        uint256 completedAt;
        string evidenceURI;
        address completedBy;
    }

    struct SpendingRecord {
        uint256 amount;
        string purpose;
        address recipient;
        uint256 timestamp;
        address recordedBy;
    }

    /// @notice A report's lifecycle. Open is the default state for any
    ///         freshly filed report. UnderReview signals an official has
    ///         seen it and is looking into it. Resolved and Dismissed
    ///         are the two ways a report gets closed out.
    enum ReportStatus {
        Open,
        UnderReview,
        Resolved,
        Dismissed
    }

    struct CitizenReport {
        address reporter;
        string comment;
        uint256 timestamp;
        ReportStatus status;
        address triagedBy;
        uint256 triagedAt;
        bool gasSponsored;
    }

    IGovRegistry public immutable registry;

    uint256 private _projectCounter;

    mapping(uint256 => Project) private _projects;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(uint256 => SpendingRecord[]) private _spendingRecords;
    mapping(uint256 => CitizenReport[]) private _reports;
    mapping(uint256 => uint256[]) private _departmentProjectIds;

    /// @dev Replay protection for signature based reports, one counter
    ///      per reporter address, independent of which project they're
    ///      reporting on.
    mapping(address => uint256) public reportNonces;

    bytes32 private constant REPORT_TYPEHASH =
        keccak256("CitizenReport(address reporter,uint256 projectId,string comment,uint256 nonce)");

    event ProjectCreated(
        uint256 indexed projectId,
        uint256 indexed departmentId,
        address indexed responsibleOfficial,
        string name,
        uint256 allocatedBudget
    );
    event ProjectStatusChanged(
        uint256 indexed projectId, address indexed changedBy, ProjectStatus oldStatus, ProjectStatus newStatus
    );
    event ResponsibleOfficialChanged(
        uint256 indexed projectId, address indexed oldOfficial, address indexed newOfficial, address changedBy
    );
    event MilestoneAdded(
        uint256 indexed projectId, address indexed addedBy, uint256 milestoneIndex, string description, uint256 targetDate
    );
    event MilestoneCompleted(
        uint256 indexed projectId, address indexed completedBy, uint256 milestoneIndex, string evidenceURI
    );
    event SpendingRecorded(
        uint256 indexed projectId, address indexed recipient, address indexed recordedBy, uint256 amount, string purpose
    );
    event CitizenReportFiled(uint256 indexed projectId, address indexed reporter, bool gasSponsored, string comment);
    event ReportStatusChanged(
        uint256 indexed projectId, address indexed changedBy, uint256 reportIndex, ReportStatus oldStatus, ReportStatus newStatus
    );

    constructor(address registryAddress) EIP712("GovLedger", "1") {
        require(registryAddress != address(0), "ProjectLedger: zero registry address");
        registry = IGovRegistry(registryAddress);
    }

    modifier onlyAuthorized(uint256 departmentId) {
        require(registry.isAuthorizedForDepartment(msg.sender, departmentId), "ProjectLedger: not authorized for department");
        _;
    }

    modifier projectExists(uint256 projectId) {
        require(_projects[projectId].createdAt != 0, "ProjectLedger: project does not exist");
        _;
    }

    // ---------------------------------------------------------------
    // Writes: restricted to officials/heads of the relevant department
    // ---------------------------------------------------------------

    function createProject(
        string calldata name,
        string calldata description,
        uint256 departmentId,
        address responsibleOfficial,
        uint256 allocatedBudget
    ) external onlyAuthorized(departmentId) returns (uint256 projectId) {
        require(registry.departmentExists(departmentId), "ProjectLedger: department does not exist");
        require(responsibleOfficial != address(0), "ProjectLedger: zero official address");
        require(
            registry.isOfficialOfDepartment(responsibleOfficial, departmentId)
                || registry.isDepartmentHead(responsibleOfficial, departmentId),
            "ProjectLedger: responsible official must belong to department"
        );

        _projectCounter += 1;
        projectId = _projectCounter;

        _projects[projectId] = Project({
            id: projectId,
            name: name,
            description: description,
            departmentId: departmentId,
            responsibleOfficial: responsibleOfficial,
            allocatedBudget: allocatedBudget,
            spentBudget: 0,
            status: ProjectStatus.Planned,
            createdAt: block.timestamp,
            createdBy: msg.sender
        });

        _departmentProjectIds[departmentId].push(projectId);

        emit ProjectCreated(projectId, departmentId, responsibleOfficial, name, allocatedBudget);
    }

    function setProjectStatus(uint256 projectId, ProjectStatus newStatus) external projectExists(projectId) {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");
        ProjectStatus old = p.status;
        p.status = newStatus;
        emit ProjectStatusChanged(projectId, msg.sender, old, newStatus);
    }

    function changeResponsibleOfficial(uint256 projectId, address newOfficial) external projectExists(projectId) {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");
        require(
            registry.isOfficialOfDepartment(newOfficial, p.departmentId)
                || registry.isDepartmentHead(newOfficial, p.departmentId),
            "ProjectLedger: new official must belong to department"
        );
        address old = p.responsibleOfficial;
        p.responsibleOfficial = newOfficial;
        emit ResponsibleOfficialChanged(projectId, old, newOfficial, msg.sender);
    }

    function addMilestone(uint256 projectId, string calldata description, uint256 targetDate)
        external
        projectExists(projectId)
        returns (uint256 milestoneIndex)
    {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");

        _milestones[projectId].push(
            Milestone({
                description: description,
                targetDate: targetDate,
                completed: false,
                completedAt: 0,
                evidenceURI: "",
                completedBy: address(0)
            })
        );
        milestoneIndex = _milestones[projectId].length - 1;
        emit MilestoneAdded(projectId, msg.sender, milestoneIndex, description, targetDate);
    }

    function completeMilestone(uint256 projectId, uint256 milestoneIndex, string calldata evidenceURI)
        external
        projectExists(projectId)
    {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");
        require(milestoneIndex < _milestones[projectId].length, "ProjectLedger: invalid milestone index");

        Milestone storage m = _milestones[projectId][milestoneIndex];
        require(!m.completed, "ProjectLedger: milestone already completed");

        m.completed = true;
        m.completedAt = block.timestamp;
        m.evidenceURI = evidenceURI;
        m.completedBy = msg.sender;

        emit MilestoneCompleted(projectId, msg.sender, milestoneIndex, evidenceURI);
    }

    function recordSpending(uint256 projectId, uint256 amount, string calldata purpose, address recipient)
        external
        projectExists(projectId)
    {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");
        require(amount > 0, "ProjectLedger: amount must be positive");
        require(p.spentBudget + amount <= p.allocatedBudget, "ProjectLedger: exceeds allocated budget");

        p.spentBudget += amount;
        _spendingRecords[projectId].push(
            SpendingRecord({
                amount: amount,
                purpose: purpose,
                recipient: recipient,
                timestamp: block.timestamp,
                recordedBy: msg.sender
            })
        );

        emit SpendingRecorded(projectId, recipient, msg.sender, amount, purpose);
    }

    // ---------------------------------------------------------------
    // Citizen reports: the only actions in this contract open to
    // absolutely anyone, no registry role required.
    // ---------------------------------------------------------------

    /// @notice File a report paying your own gas.
    function fileCitizenReport(uint256 projectId, string calldata comment) external projectExists(projectId) returns (uint256 reportIndex) {
        reportIndex = _pushReport(projectId, msg.sender, comment, false);
    }

    /// @notice File a report on behalf of `reporter`, gas paid by
    ///         whoever calls this (typically ReportingTreasury on
    ///         behalf of a relayer). `reporter` never signs or sends a
    ///         transaction themselves, only an off-chain EIP-712
    ///         signature proving they authored this exact report.
    ///         Callable by anyone, the signature is what authenticates
    ///         the reporter, not msg.sender.
    function fileCitizenReportBySignature(
        address reporter,
        uint256 projectId,
        string calldata comment,
        bytes calldata signature
    ) external projectExists(projectId) returns (uint256 reportIndex) {
        uint256 nonce = reportNonces[reporter];
        bytes32 structHash = keccak256(abi.encode(REPORT_TYPEHASH, reporter, projectId, keccak256(bytes(comment)), nonce));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        require(recovered == reporter, "ProjectLedger: invalid signature");

        reportNonces[reporter] = nonce + 1;
        reportIndex = _pushReport(projectId, reporter, comment, true);
    }

    function _pushReport(uint256 projectId, address reporter, string calldata comment, bool gasSponsored)
        private
        returns (uint256 reportIndex)
    {
        _reports[projectId].push(
            CitizenReport({
                reporter: reporter,
                comment: comment,
                timestamp: block.timestamp,
                status: ReportStatus.Open,
                triagedBy: address(0),
                triagedAt: 0,
                gasSponsored: gasSponsored
            })
        );
        reportIndex = _reports[projectId].length - 1;
        emit CitizenReportFiled(projectId, reporter, gasSponsored, comment);
    }

    /// @notice Lets an official (or head, or admin) of a project's
    ///         department move a citizen report through its lifecycle:
    ///         mark it under review, then resolved or dismissed.
    function updateReportStatus(uint256 projectId, uint256 reportIndex, ReportStatus newStatus)
        external
        projectExists(projectId)
    {
        Project storage p = _projects[projectId];
        require(registry.isAuthorizedForDepartment(msg.sender, p.departmentId), "ProjectLedger: not authorized for department");
        require(reportIndex < _reports[projectId].length, "ProjectLedger: invalid report index");

        CitizenReport storage r = _reports[projectId][reportIndex];
        ReportStatus old = r.status;
        r.status = newStatus;
        r.triagedBy = msg.sender;
        r.triagedAt = block.timestamp;

        emit ReportStatusChanged(projectId, msg.sender, reportIndex, old, newStatus);
    }

    /// @notice The EIP-712 domain separator's name/version plus this
    ///         contract's address and chain id are what MetaMask shows
    ///         (and what a signature is scoped to) when a citizen signs
    ///         a report. Exposed so the frontend can build the exact
    ///         same typed data structure without guessing at it.
    function eip712Domain_()
        external
        view
        returns (string memory name, string memory version, uint256 chainId, address verifyingContract)
    {
        name = "GovLedger";
        version = "1";
        chainId = block.chainid;
        verifyingContract = address(this);
    }

    // ---------------------------------------------------------------
    // Views: open to everyone, no restriction. This is the "public
    // ledger" part of the dapp.
    // ---------------------------------------------------------------

    function getProject(uint256 projectId) external view returns (Project memory) {
        require(_projects[projectId].createdAt != 0, "ProjectLedger: project does not exist");
        return _projects[projectId];
    }

    function getProjectCount() external view returns (uint256) {
        return _projectCounter;
    }

    function getMilestones(uint256 projectId) external view returns (Milestone[] memory) {
        return _milestones[projectId];
    }

    function getSpendingRecords(uint256 projectId) external view returns (SpendingRecord[] memory) {
        return _spendingRecords[projectId];
    }

    function getReports(uint256 projectId) external view returns (CitizenReport[] memory) {
        return _reports[projectId];
    }

    function getDepartmentProjectIds(uint256 departmentId) external view returns (uint256[] memory) {
        return _departmentProjectIds[departmentId];
    }
}
