// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface that ProjectLedger (and future modules) use
///         to check identity and authorization against GovRegistry.
///         Keeping this as a small interface means ProjectLedger never
///         needs to know about roles, departments internals, etc, it
///         just asks "is this account allowed to act for this department".
interface IGovRegistry {
    function isOfficialOfDepartment(address account, uint256 departmentId) external view returns (bool);

    function isDepartmentHead(address account, uint256 departmentId) external view returns (bool);

    function isAuthorizedForDepartment(address account, uint256 departmentId) external view returns (bool);

    function departmentExists(uint256 departmentId) external view returns (bool);
}
