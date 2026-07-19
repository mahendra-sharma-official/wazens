// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// interface used by other contracts to check permissions and department data.
interface IGovRegistry {
    // checks if an account is an active official of a department.
    function isOfficialOfDepartment(
        address account,
        uint256 departmentId
    ) external view returns (bool);

    // checks if an account is the head of a department.
    function isDepartmentHead(
        address account,
        uint256 departmentId
    ) external view returns (bool);

    // checks if an account is authorized to act for a department.
    function isAuthorizedForDepartment(
        address account,
        uint256 departmentId
    ) external view returns (bool);

    // checks if a department exists.
    function departmentExists(
        uint256 departmentId
    ) external view returns (bool);
}