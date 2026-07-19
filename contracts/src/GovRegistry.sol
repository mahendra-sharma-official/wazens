// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IGovRegistry.sol";

// Registry contract for managing departments and officials.
contract GovRegistry is AccessControl, IGovRegistry {
    // role assigned to department heads.
    bytes32 public constant DEPARTMENT_HEAD_ROLE =
        keccak256("DEPARTMENT_HEAD_ROLE");

    // role assigned to government officials.
    bytes32 public constant OFFICIAL_ROLE =
        keccak256("OFFICIAL_ROLE");

    // structure for storing department information.
    struct Department {
        uint256 id;
        string name;
        address head;
        string headName;
        bool exists;
    }

    // structure for storing official information.
    struct OfficialInfo {
        string name;
        uint256 departmentId;
        bool active;
        address addedBy;
        uint256 addedAt;
        address deactivatedBy;
        uint256 deactivatedAt;
    }

    // counter for generating department ids.
    uint256 private _departmentCounter;

    // stores departments by their id.
    mapping(uint256 => Department) private _departments;

    // stores information about each official.
    mapping(address => OfficialInfo) private _officials;

    // stores all officials belonging to a department.
    mapping(uint256 => address[]) private _departmentOfficials;

    // events emitted whenever registry data changes.
    event DepartmentCreated(
        uint256 indexed departmentId,
        address indexed head,
        address indexed createdBy,
        string name
    );

    event DepartmentHeadChanged(
        uint256 indexed departmentId,
        address indexed oldHead,
        address indexed newHead
    );

    event OfficialAdded(
        address indexed official,
        uint256 indexed departmentId,
        address indexed addedBy,
        string name
    );

    event OfficialDeactivated(
        address indexed official,
        uint256 indexed departmentId,
        address indexed deactivatedBy
    );

    // constructor for the GovRegistry contract.
    constructor(address admin) {
        require(admin != address(0), "GovRegistry: zero admin");

        // granting admin role to the provided address.
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ensures caller is either the department head or an admin.
    modifier onlyDepartmentHeadOrAdmin(uint256 departmentId) {
        require(
            _departments[departmentId].exists,
            "GovRegistry: department does not exist"
        );

        require(
            _departments[departmentId].head == msg.sender ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GovRegistry: caller is not department head or admin"
        );

        _;
    }

    // admin functions.

    function createDepartment(
        string calldata name,
        address head,
        string calldata headName
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        returns (uint256 departmentId)
    {
        require(head != address(0), "GovRegistry: zero head address");

        // generating a new department id.
        _departmentCounter += 1;
        departmentId = _departmentCounter;

        // creating and storing the department.
        _departments[departmentId] = Department({
            id: departmentId,
            name: name,
            head: head,
            headName: headName,
            exists: true
        });

        // granting department head role.
        _grantRole(DEPARTMENT_HEAD_ROLE, head);

        emit DepartmentCreated(
            departmentId,
            head,
            msg.sender,
            name
        );
    }

    function changeDepartmentHead(
        uint256 departmentId,
        address newHead,
        string calldata newHeadName
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _departments[departmentId].exists,
            "GovRegistry: department does not exist"
        );

        require(
            newHead != address(0),
            "GovRegistry: zero head address"
        );

        address oldHead = _departments[departmentId].head;

        // updating roles if the head changes.
        if (oldHead != newHead) {
            _revokeRole(DEPARTMENT_HEAD_ROLE, oldHead);

            _departments[departmentId].head = newHead;

            _grantRole(DEPARTMENT_HEAD_ROLE, newHead);
        }

        // updating the head's display name.
        _departments[departmentId].headName = newHeadName;

        emit DepartmentHeadChanged(
            departmentId,
            oldHead,
            newHead
        );
    }

    // department head functions.

    function addOfficial(
        address official,
        string calldata name,
        uint256 departmentId
    ) external onlyDepartmentHeadOrAdmin(departmentId) {
        require(
            official != address(0),
            "GovRegistry: zero official address"
        );

        require(
            !_officials[official].active,
            "GovRegistry: official already active"
        );

        // creating and storing official information.
        _officials[official] = OfficialInfo({
            name: name,
            departmentId: departmentId,
            active: true,
            addedBy: msg.sender,
            addedAt: block.timestamp,
            deactivatedBy: address(0),
            deactivatedAt: 0
        });

        // adding the official to the department list.
        _departmentOfficials[departmentId].push(official);

        // granting official role.
        _grantRole(OFFICIAL_ROLE, official);

        emit OfficialAdded(
            official,
            departmentId,
            msg.sender,
            name
        );
    }

    function deactivateOfficial(address official) external {
        OfficialInfo storage info = _officials[official];

        require(
            info.active,
            "GovRegistry: official not active"
        );

        require(
            _departments[info.departmentId].head == msg.sender ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "GovRegistry: not authorized to deactivate"
        );

        // marking the official as inactive.
        info.active = false;
        info.deactivatedBy = msg.sender;
        info.deactivatedAt = block.timestamp;

        // removing official role.
        _revokeRole(OFFICIAL_ROLE, official);

        emit OfficialDeactivated(
            official,
            info.departmentId,
            msg.sender
        );
    }

    // permission checking functions.

    function isOfficialOfDepartment(
        address account,
        uint256 departmentId
    ) public view returns (bool) {
        OfficialInfo memory info = _officials[account];

        return info.active &&
            info.departmentId == departmentId;
    }

    function isDepartmentHead(
        address account,
        uint256 departmentId
    ) public view returns (bool) {
        return _departments[departmentId].exists &&
            _departments[departmentId].head == account;
    }

    function isAuthorizedForDepartment(
        address account,
        uint256 departmentId
    ) public view returns (bool) {
        return
            isOfficialOfDepartment(
                account,
                departmentId
            ) ||
            isDepartmentHead(
                account,
                departmentId
            ) ||
            hasRole(DEFAULT_ADMIN_ROLE, account);
    }

    function departmentExists(
        uint256 departmentId
    ) public view returns (bool) {
        return _departments[departmentId].exists;
    }

    function getDepartment(
        uint256 departmentId
    ) external view returns (Department memory) {
        require(
            _departments[departmentId].exists,
            "GovRegistry: department does not exist"
        );

        return _departments[departmentId];
    }

    function getDepartmentCount()
        external
        view
        returns (uint256)
    {
        return _departmentCounter;
    }

    function getOfficial(
        address account
    ) external view returns (OfficialInfo memory) {
        return _officials[account];
    }

    // returns all officials ever added to a department.
    function getDepartmentOfficials(
        uint256 departmentId
    ) external view returns (address[] memory) {
        return _departmentOfficials[departmentId];
    }
}