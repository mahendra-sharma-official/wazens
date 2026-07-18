// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IGovRegistry.sol";

/// @title ProjectLedger
/// @notice The public ledger of government projects. Anyone can read
///         every project, milestone and spending record. Writing is
///         restricted to officials/department heads recognized by
///         GovRegistry for that specific project's department, so
///         there is always a clear, on-chain trail of who is
///         responsible and who recorded what.
contract ProjectLedger {
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
    ///         are the two ways a report gets closed out, kept separate
    ///         so the public can see the difference between "this was
    ///         acted on" and "this was not considered valid".
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
    }

    IGovRegistry public immutable registry;

    uint256 private _projectCounter;

    mapping(uint256 => Project) private _projects;
    mapping(uint256 => Milestone[]) private _milestones;
    mapping(uint256 => SpendingRecord[]) private _spendingRecords;
    mapping(uint256 => CitizenReport[]) private _reports;

    // Lets the frontend (and any future module) look up "which projects
    // belong to this department" directly instead of scanning every
    // project id and checking its departmentId one by one.
    mapping(uint256 => uint256[]) private _departmentProjectIds;

    event ProjectCreated(
        uint256 indexed projectId,
        uint256 indexed departmentId,
        address indexed responsibleOfficial,
        string name,
        uint256 allocatedBudget
    );
    event ProjectStatusChanged(uint256 indexed projectId, ProjectStatus oldStatus, ProjectStatus newStatus, address changedBy);
    event ResponsibleOfficialChanged(uint256 indexed projectId, address oldOfficial, address newOfficial, address changedBy);
    event MilestoneAdded(uint256 indexed projectId, uint256 indexed milestoneIndex, string description, uint256 targetDate);
    event MilestoneCompleted(uint256 indexed projectId, uint256 indexed milestoneIndex, string evidenceURI, address completedBy);
    event SpendingRecorded(uint256 indexed projectId, uint256 amount, string purpose, address indexed recipient, address indexed recordedBy);
    event CitizenReportFiled(uint256 indexed projectId, address indexed reporter, string comment);
    event ReportStatusChanged(
        uint256 indexed projectId, uint256 indexed reportIndex, ReportStatus oldStatus, ReportStatus newStatus, address changedBy
    );

    constructor(address registryAddress) {
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
        emit ProjectStatusChanged(projectId, old, newStatus, msg.sender);
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
        emit MilestoneAdded(projectId, milestoneIndex, description, targetDate);
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

        emit MilestoneCompleted(projectId, milestoneIndex, evidenceURI, msg.sender);
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

        emit SpendingRecorded(projectId, amount, purpose, recipient, msg.sender);
    }

    /// @notice Anyone can file a report/comment against a project. No
    ///         restriction on caller. The report starts life as Open,
    ///         see updateReportStatus for how officials triage it.
    function fileCitizenReport(uint256 projectId, string calldata comment) external projectExists(projectId) returns (uint256 reportIndex) {
        _reports[projectId].push(
            CitizenReport({
                reporter: msg.sender,
                comment: comment,
                timestamp: block.timestamp,
                status: ReportStatus.Open,
                triagedBy: address(0),
                triagedAt: 0
            })
        );
        reportIndex = _reports[projectId].length - 1;
        emit CitizenReportFiled(projectId, msg.sender, comment);
    }

    /// @notice Lets an official (or head, or admin) of a project's
    ///         department move a citizen report through its lifecycle:
    ///         mark it under review, then resolved or dismissed. This
    ///         is what an "Official Portal" report queue is built on.
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

        emit ReportStatusChanged(projectId, reportIndex, old, newStatus, msg.sender);
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
