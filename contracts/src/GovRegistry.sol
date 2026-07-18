// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IGovRegistry.sol";

/// @title GovRegistry
/// @notice The identity and permission layer of the transparency ledger.
///         Holds the list of government departments, who heads each
///         department, and which addresses are recognized officials of
///         which department. All other modules (ProjectLedger etc) read
///         from this contract instead of managing their own permissions,
///         so adding a new module later does not mean reimplementing
///         access control.
contract GovRegistry is AccessControl, IGovRegistry {
    bytes32 public constant DEPARTMENT_HEAD_ROLE = keccak256("DEPARTMENT_HEAD_ROLE");
    bytes32 public constant OFFICIAL_ROLE = keccak256("OFFICIAL_ROLE");

    struct Department {
        uint256 id;
        string name;
        address head;
        bool exists;
    }

    struct OfficialInfo {
        string name;
        uint256 departmentId;
        bool active;
    }

    uint256 private _departmentCounter;

    mapping(uint256 => Department) private _departments;
    mapping(address => OfficialInfo) private _officials;
    mapping(uint256 => address[]) private _departmentOfficials;

    event DepartmentCreated(uint256 indexed departmentId, string name, address indexed head);
    event DepartmentHeadChanged(uint256 indexed departmentId, address indexed oldHead, address indexed newHead);
    event OfficialAdded(address indexed official, uint256 indexed departmentId, string name);
    event OfficialDeactivated(address indexed official, uint256 indexed departmentId);

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
    // departments and assign their heads.
    // ---------------------------------------------------------------

    function createDepartment(string calldata name, address head)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 departmentId)
    {
        require(head != address(0), "GovRegistry: zero head address");
        _departmentCounter += 1;
        departmentId = _departmentCounter;
        _departments[departmentId] = Department({id: departmentId, name: name, head: head, exists: true});
        _grantRole(DEPARTMENT_HEAD_ROLE, head);
        emit DepartmentCreated(departmentId, name, head);
    }

    function changeDepartmentHead(uint256 departmentId, address newHead) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_departments[departmentId].exists, "GovRegistry: department does not exist");
        require(newHead != address(0), "GovRegistry: zero head address");
        address oldHead = _departments[departmentId].head;
        if (oldHead != newHead) {
            _revokeRole(DEPARTMENT_HEAD_ROLE, oldHead);
            _departments[departmentId].head = newHead;
            _grantRole(DEPARTMENT_HEAD_ROLE, newHead);
        }
        emit DepartmentHeadChanged(departmentId, oldHead, newHead);
    }

    // ---------------------------------------------------------------
    // Department head actions: a department head (or admin) manages
    // the officials working under their department.
    // ---------------------------------------------------------------

    function addOfficial(address official, string calldata name, uint256 departmentId)
        external
        onlyDepartmentHeadOrAdmin(departmentId)
    {
        require(official != address(0), "GovRegistry: zero official address");
        require(!_officials[official].active, "GovRegistry: official already active");
        _officials[official] = OfficialInfo({name: name, departmentId: departmentId, active: true});
        _departmentOfficials[departmentId].push(official);
        _grantRole(OFFICIAL_ROLE, official);
        emit OfficialAdded(official, departmentId, name);
    }

    function deactivateOfficial(address official) external {
        OfficialInfo storage info = _officials[official];
        require(info.active, "GovRegistry: official not active");
        require(
            _departments[info.departmentId].head == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GovRegistry: not authorized to deactivate"
        );
        info.active = false;
        _revokeRole(OFFICIAL_ROLE, official);
        emit OfficialDeactivated(official, info.departmentId);
    }

    // ---------------------------------------------------------------
    // Views used both by the frontend and by other contracts
    // (ProjectLedger) to check permissions.
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

    function getDepartmentOfficials(uint256 departmentId) external view returns (address[] memory) {
        return _departmentOfficials[departmentId];
    }

    // AccessControl <-> IGovRegistry both declare no clashing members,
    // but we surface hasRole publicly already via AccessControl.
}
