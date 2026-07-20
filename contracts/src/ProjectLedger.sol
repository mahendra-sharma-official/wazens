// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IGovRegistry.sol";

// Public ledger contract for government projects.
contract ProjectLedger is EIP712 {
    // different statuses that a project can be in.
    enum ProjectStatus {
        Planned,
        Ongoing,
        Completed,
        Cancelled
    }

    // structure for storing project information.
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

    // structure for storing project milestones.
    struct Milestone {
        string description;
        uint256 targetDate;
        bool completed;
        uint256 completedAt;
        string evidenceURI;
        address completedBy;
    }

    // structure for storing spending records.
    struct SpendingRecord {
        uint256 amount;
        string purpose;
        address recipient;
        uint256 timestamp;
        address recordedBy;
    }

    // different statuses that a citizen report can be in.
    enum ReportStatus {
        Open,
        UnderReview,
        Resolved,
        Dismissed
    }

    // structure for storing citizen reports.
    struct CitizenReport {
        address reporter;
        string comment;
        uint256 timestamp;
        ReportStatus status;
        address triagedBy;
        uint256 triagedAt;
        bool gasSponsored;
    }

    // registry contract for checking roles and permissions.
    IGovRegistry public immutable registry;

    // counter for generating project ids.
    uint256 private _projectCounter;

    // stores projects by their id.
    mapping(uint256 => Project) private _projects;

    // stores milestones for each project.
    mapping(uint256 => Milestone[]) private _milestones;

    // stores spending records for each project.
    mapping(uint256 => SpendingRecord[]) private _spendingRecords;

    // stores citizen reports for each project.
    mapping(uint256 => CitizenReport[]) private _reports;

    // stores project ids grouped by department.
    mapping(uint256 => uint256[]) private _departmentProjectIds;

    // nonce for preventing replay attacks on signed reports.
    mapping(address => uint256) public reportNonces;

    // EIP-712 typehash used for signed citizen reports.
    bytes32 private constant REPORT_TYPEHASH =
        keccak256(
            "CitizenReport(address reporter,uint256 projectId,string comment,uint256 nonce)"
        );

    // events emitted whenever project data changes.
    event ProjectCreated(
        uint256 indexed projectId,
        uint256 indexed departmentId,
        address indexed responsibleOfficial,
        string name,
        uint256 allocatedBudget
    );

    event ProjectStatusChanged(
        uint256 indexed projectId,
        address indexed changedBy,
        ProjectStatus oldStatus,
        ProjectStatus newStatus
    );

    event ResponsibleOfficialChanged(
        uint256 indexed projectId,
        address indexed oldOfficial,
        address indexed newOfficial,
        address changedBy
    );

    event MilestoneAdded(
        uint256 indexed projectId,
        address indexed addedBy,
        uint256 milestoneIndex,
        string description,
        uint256 targetDate
    );

    event MilestoneCompleted(
        uint256 indexed projectId,
        address indexed completedBy,
        uint256 milestoneIndex,
        string evidenceURI
    );

    event SpendingRecorded(
        uint256 indexed projectId,
        address indexed recipient,
        address indexed recordedBy,
        uint256 amount,
        string purpose
    );

    event CitizenReportFiled(
        uint256 indexed projectId,
        address indexed reporter,
        bool gasSponsored,
        string comment
    );

    event ReportStatusChanged(
        uint256 indexed projectId,
        address indexed changedBy,
        uint256 reportIndex,
        ReportStatus oldStatus,
        ReportStatus newStatus
    );

    // constructor for the ProjectLedger contract.
    constructor(address registryAddress) EIP712("GovLedger", "1") {
        require(
            registryAddress != address(0),
            "ProjectLedger: zero registry address"
        );

        // initializing the registry contract.
        registry = IGovRegistry(registryAddress);
    }

    // ensures caller is authorized for the given department.
    modifier onlyAuthorized(uint256 departmentId) {
        require(
            registry.isAuthorizedForDepartment(msg.sender, departmentId),
            "ProjectLedger: not authorized for department"
        );
        _;
    }

    // ensures the project exists before continuing.
    modifier projectExists(uint256 projectId) {
        require(
            _projects[projectId].createdAt != 0,
            "ProjectLedger: project does not exist"
        );
        _;
    }

    // write functions restricted to authorized department members.

    function createProject(
        string calldata name,
        string calldata description,
        uint256 departmentId,
        address responsibleOfficial,
        uint256 allocatedBudget
    ) external onlyAuthorized(departmentId) returns (uint256 projectId) {
        require(
            registry.departmentExists(departmentId),
            "ProjectLedger: department does not exist"
        );

        require(
            responsibleOfficial != address(0),
            "ProjectLedger: zero official address"
        );

        require(
            registry.isOfficialOfDepartment(
                responsibleOfficial,
                departmentId
            ) ||
                registry.isDepartmentHead(
                    responsibleOfficial,
                    departmentId
                ),
            "ProjectLedger: responsible official must belong to department"
        );

        // generating a new project id.
        _projectCounter += 1;
        projectId = _projectCounter;

        // storing the new project.
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

        // adding the project to its department list.
        _departmentProjectIds[departmentId].push(projectId);

        emit ProjectCreated(
            projectId,
            departmentId,
            responsibleOfficial,
            name,
            allocatedBudget
        );
    }

    function setProjectStatus(
        uint256 projectId,
        ProjectStatus newStatus
    ) external projectExists(projectId) {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        ProjectStatus old = p.status;
        p.status = newStatus;

        emit ProjectStatusChanged(
            projectId,
            msg.sender,
            old,
            newStatus
        );
    }

    function changeResponsibleOfficial(
        uint256 projectId,
        address newOfficial
    ) external projectExists(projectId) {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        require(
            registry.isOfficialOfDepartment(
                newOfficial,
                p.departmentId
            ) ||
                registry.isDepartmentHead(
                    newOfficial,
                    p.departmentId
                ),
            "ProjectLedger: new official must belong to department"
        );

        address old = p.responsibleOfficial;
        p.responsibleOfficial = newOfficial;

        emit ResponsibleOfficialChanged(
            projectId,
            old,
            newOfficial,
            msg.sender
        );
    }

    function addMilestone(
        uint256 projectId,
        string calldata description,
        uint256 targetDate
    )
        external
        projectExists(projectId)
        returns (uint256 milestoneIndex)
    {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        // creating and storing the milestone.
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

        emit MilestoneAdded(
            projectId,
            msg.sender,
            milestoneIndex,
            description,
            targetDate
        );
    }

    function completeMilestone(
        uint256 projectId,
        uint256 milestoneIndex,
        string calldata evidenceURI
    ) external projectExists(projectId) {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        require(
            milestoneIndex < _milestones[projectId].length,
            "ProjectLedger: invalid milestone index"
        );

        Milestone storage m = _milestones[projectId][milestoneIndex];

        require(
            !m.completed,
            "ProjectLedger: milestone already completed"
        );

        // marking the milestone as completed.
        m.completed = true;
        m.completedAt = block.timestamp;
        m.evidenceURI = evidenceURI;
        m.completedBy = msg.sender;

        emit MilestoneCompleted(
            projectId,
            msg.sender,
            milestoneIndex,
            evidenceURI
        );
    }

    function recordSpending(
        uint256 projectId,
        uint256 amount,
        string calldata purpose,
        address recipient
    ) external projectExists(projectId) {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        require(
            amount > 0,
            "ProjectLedger: amount must be positive"
        );

        require(
            p.spentBudget + amount <= p.allocatedBudget,
            "ProjectLedger: exceeds allocated budget"
        );

        // increasing the spent budget.
        p.spentBudget += amount;

        // storing the spending record.
        _spendingRecords[projectId].push(
            SpendingRecord({
                amount: amount,
                purpose: purpose,
                recipient: recipient,
                timestamp: block.timestamp,
                recordedBy: msg.sender
            })
        );

        emit SpendingRecorded(
            projectId,
            recipient,
            msg.sender,
            amount,
            purpose
        );
    }

    // citizen reporting functions (open to everyone).

    // file a report while paying your own gas.
    function fileCitizenReport(
        uint256 projectId,
        string calldata comment
    ) external projectExists(projectId) returns (uint256 reportIndex) {
        reportIndex = _pushReport(
            projectId,
            msg.sender,
            comment,
            false
        );
    }

    // file a report using an off-chain signature and sponsored gas.
    function fileCitizenReportBySignature(
        address reporter,
        uint256 projectId,
        string calldata comment,
        bytes calldata signature
    ) external projectExists(projectId) returns (uint256 reportIndex) {
        // getting the current nonce for the reporter.
        uint256 nonce = reportNonces[reporter];

        // creating the EIP-712 message hash.
        bytes32 structHash = keccak256(
            abi.encode(
                REPORT_TYPEHASH,
                reporter,
                projectId,
                keccak256(bytes(comment)),
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        // recovering the signer from the signature.
        address recovered = ECDSA.recover(
            digest,
            signature
        );

        // making sure the signature belongs to the reporter.
        require(
            recovered == reporter,
            "ProjectLedger: invalid signature"
        );

        // incrementing the nonce after successful verification.
        reportNonces[reporter] = nonce + 1;

        reportIndex = _pushReport(
            projectId,
            reporter,
            comment,
            true
        );
    }

    function _pushReport(
        uint256 projectId,
        address reporter,
        string calldata comment,
        bool gasSponsored
    ) private returns (uint256 reportIndex) {
        // creating and storing the report.
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

        emit CitizenReportFiled(
            projectId,
            reporter,
            gasSponsored,
            comment
        );
    }

    // update the status of a citizen report.
    function updateReportStatus(
        uint256 projectId,
        uint256 reportIndex,
        ReportStatus newStatus
    )
        external
        projectExists(projectId)
    {
        // fetching the project.
        Project storage p = _projects[projectId];

        require(
            registry.isAuthorizedForDepartment(
                msg.sender,
                p.departmentId
            ),
            "ProjectLedger: not authorized for department"
        );

        require(
            reportIndex < _reports[projectId].length,
            "ProjectLedger: invalid report index"
        );

        CitizenReport storage r =
            _reports[projectId][reportIndex];

        // updating the report status and triage info.
        ReportStatus old = r.status;
        r.status = newStatus;
        r.triagedBy = msg.sender;
        r.triagedAt = block.timestamp;

        emit ReportStatusChanged(
            projectId,
            msg.sender,
            reportIndex,
            old,
            newStatus
        );
    }

    // returns EIP-712 domain data used by the frontend.
    function eip712Domain_()
        external
        view
        returns (
            string memory name,
            string memory version,
            uint256 chainId,
            address verifyingContract
        )
    {
        name = "GovLedger";
        version = "1";
        chainId = block.chainid;
        verifyingContract = address(this);
    }

    // public view functions.

    function getProject(
        uint256 projectId
    ) external view returns (Project memory) {
        require(
            _projects[projectId].createdAt != 0,
            "ProjectLedger: project does not exist"
        );

        return _projects[projectId];
    }

    function getProjectCount() external view returns (uint256) {
        return _projectCounter;
    }

    function getMilestones(
        uint256 projectId
    ) external view returns (Milestone[] memory) {
        return _milestones[projectId];
    }

    function getSpendingRecords(
        uint256 projectId
    ) external view returns (SpendingRecord[] memory) {
        return _spendingRecords[projectId];
    }

    function getReports(
        uint256 projectId
    ) external view returns (CitizenReport[] memory) {
        return _reports[projectId];
    }

    function getDepartmentProjectIds(
        uint256 departmentId
    ) external view returns (uint256[] memory) {
        return _departmentProjectIds[departmentId];
    }
}