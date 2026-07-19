// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IGovRegistry.sol";

/// @title GovRegistry
/// @notice The identity and permission layer of the transparency ledger,
///         and the "official registry" the rest of the app reads from:
///         every department, who heads it, and every address that has
///         ever been registered as an official, including who added
///         them and when, so that even a manual entry always has a
///         clear accountable source.
contract GovRegistry is AccessControl, IGovRegistry {
    bytes32 public constant DEPARTMENT_HEAD_ROLE = keccak256("DEPARTMENT_HEAD_ROLE");
    bytes32 public constant OFFICIAL_ROLE = keccak256("OFFICIAL_ROLE");

    struct Department {
        uint256 id;
        string name;
        address head;
        string headName;
        bool exists;
    }

    struct OfficialInfo {
        string name;
        uint256 departmentId;
        bool active;
        address addedBy;
        uint256 addedAt;
        address deactivatedBy;
        uint256 deactivatedAt;
    }

    uint256 private _departmentCounter;

    mapping(uint256 => Department) private _departments;
    mapping(address => OfficialInfo) private _officials;
    mapping(uint256 => address[]) private _departmentOfficials;

    event DepartmentCreated(uint256 indexed departmentId, address indexed head, address indexed createdBy, string name);
    event DepartmentHeadChanged(uint256 indexed departmentId, address indexed oldHead, address indexed newHead);
    event OfficialAdded(address indexed official, uint256 indexed departmentId, address indexed addedBy, string name);
    event OfficialDeactivated(address indexed official, uint256 indexed departmentId, address indexed deactivatedBy);

    constructor(address admin) {
        require(admin != address(0), "GovRegistry: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    modifier onlyDepartmentHeadOrAdmin(uint256 departmentId) {
        require(_departments[departmentId].exists, "GovRegistry: department does not exist");
        require(
            _departments[departmentId].head == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GovRegistry: caller is not department head or admin"
        );
        _;
    }

    // ---------------------------------------------------------------
    // Admin actions: only the top level government admin (deployer, or
    // whoever the admin role is later transferred to) can create
    // departments and assign their heads. A head has a display name
    // too, the same as officials do, so the public registry never has
    // to show a head as a bare, nameless address.
    // ---------------------------------------------------------------

    function createDepartment(string calldata name, address head, string calldata headName)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 departmentId)
    {
        require(head != address(0), "GovRegistry: zero head address");
        _departmentCounter += 1;
        departmentId = _departmentCounter;
        _departments[departmentId] =
            Department({id: departmentId, name: name, head: head, headName: headName, exists: true});
        _grantRole(DEPARTMENT_HEAD_ROLE, head);
        emit DepartmentCreated(departmentId, head, msg.sender, name);
    }

    function changeDepartmentHead(uint256 departmentId, address newHead, string calldata newHeadName)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_departments[departmentId].exists, "GovRegistry: department does not exist");
        require(newHead != address(0), "GovRegistry: zero head address");
        address oldHead = _departments[departmentId].head;
        if (oldHead != newHead) {
            _revokeRole(DEPARTMENT_HEAD_ROLE, oldHead);
            _departments[departmentId].head = newHead;
            _grantRole(DEPARTMENT_HEAD_ROLE, newHead);
        }
        _departments[departmentId].headName = newHeadName;
        emit DepartmentHeadChanged(departmentId, oldHead, newHead);
    }

    // ---------------------------------------------------------------
    // Department head actions: a department head (or admin) manages
    // the officials working under their department. Every addition is
    // stamped with who added it and when, so a manually entered
    // address always has an accountable source on chain.
    // ---------------------------------------------------------------

    function addOfficial(address official, string calldata name, uint256 departmentId)
        external
        onlyDepartmentHeadOrAdmin(departmentId)
    {
        require(official != address(0), "GovRegistry: zero official address");
        require(!_officials[official].active, "GovRegistry: official already active");
        _officials[official] = OfficialInfo({
            name: name,
            departmentId: departmentId,
            active: true,
            addedBy: msg.sender,
            addedAt: block.timestamp,
            deactivatedBy: address(0),
            deactivatedAt: 0
        });
        _departmentOfficials[departmentId].push(official);
        _grantRole(OFFICIAL_ROLE, official);
        emit OfficialAdded(official, departmentId, msg.sender, name);
    }

    function deactivateOfficial(address official) external {
        OfficialInfo storage info = _officials[official];
        require(info.active, "GovRegistry: official not active");
        require(
            _departments[info.departmentId].head == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GovRegistry: not authorized to deactivate"
        );
        info.active = false;
        info.deactivatedBy = msg.sender;
        info.deactivatedAt = block.timestamp;
        _revokeRole(OFFICIAL_ROLE, official);
        emit OfficialDeactivated(official, info.departmentId, msg.sender);
    }

    // ---------------------------------------------------------------
    // Views used both by the frontend and by other contracts
    // (ProjectLedger, Tender) to check permissions.
    // ---------------------------------------------------------------

    function isOfficialOfDepartment(address account, uint256 departmentId) public view returns (bool) {
        OfficialInfo memory info = _officials[account];
        return info.active && info.departmentId == departmentId;
    }

    function isDepartmentHead(address account, uint256 departmentId) public view returns (bool) {
        return _departments[departmentId].exists && _departments[departmentId].head == account;
    }

    function isAuthorizedForDepartment(address account, uint256 departmentId) public view returns (bool) {
        return isOfficialOfDepartment(account, departmentId) || isDepartmentHead(account, departmentId)
            || hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function departmentExists(uint256 departmentId) public view returns (bool) {
        return _departments[departmentId].exists;
    }

    function getDepartment(uint256 departmentId) external view returns (Department memory) {
        require(_departments[departmentId].exists, "GovRegistry: department does not exist");
        return _departments[departmentId];
    }

    function getDepartmentCount() external view returns (uint256) {
        return _departmentCounter;
    }

    function getOfficial(address account) external view returns (OfficialInfo memory) {
        return _officials[account];
    }

    /// @notice Every address ever added under this department, active
    ///         or not, in the order they were added. The frontend
    ///         filters by `.active` where only current staff should
    ///         show, and shows the full list where a history view is
    ///         wanted instead.
    function getDepartmentOfficials(uint256 departmentId) external view returns (address[] memory) {
        return _departmentOfficials[departmentId];
    }
}
