// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";

contract GovRegistryTest is Test {
    GovRegistry registry;

    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address official = address(0xC0C0);
    address stranger = address(0xD00D);

    function setUp() public {
        registry = new GovRegistry(admin);
    }

    function test_AdminCanCreateDepartment() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        assertEq(id, 1);
        GovRegistry.Department memory dept = registry.getDepartment(id);
        assertEq(dept.name, "Ministry of Health");
        assertEq(dept.head, head);
        assertTrue(registry.isDepartmentHead(head, id));
    }

    function test_NonAdminCannotCreateDepartment() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.createDepartment("Ministry of Health", head);
    }

    function test_DepartmentHeadCanAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);

        assertTrue(registry.isOfficialOfDepartment(official, id));
        assertTrue(registry.isAuthorizedForDepartment(official, id));
    }

    function test_StrangerCannotAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        vm.prank(stranger);
        vm.expectRevert();
        registry.addOfficial(official, "Dr. Sharma", id);
    }

    function test_AdminCanAlsoAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        vm.prank(admin);
        registry.addOfficial(official, "Dr. Sharma", id);

        assertTrue(registry.isOfficialOfDepartment(official, id));
    }

    function test_DeactivateOfficialRemovesAuthorization() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);
        assertTrue(registry.isOfficialOfDepartment(official, id));

        vm.prank(head);
        registry.deactivateOfficial(official);
        assertFalse(registry.isOfficialOfDepartment(official, id));
        assertFalse(registry.isAuthorizedForDepartment(official, id));
    }

    function test_OfficialFromOtherDepartmentIsNotAuthorized() public {
        vm.startPrank(admin);
        uint256 healthId = registry.createDepartment("Ministry of Health", head);
        address otherHead = address(0xE0E0);
        uint256 infraId = registry.createDepartment("Ministry of Infrastructure", otherHead);
        vm.stopPrank();

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", healthId);

        assertTrue(registry.isAuthorizedForDepartment(official, healthId));
        assertFalse(registry.isAuthorizedForDepartment(official, infraId));
    }

    function test_ChangeDepartmentHead() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head);

        address newHead = address(0xF00F);
        vm.prank(admin);
        registry.changeDepartmentHead(id, newHead);

        assertTrue(registry.isDepartmentHead(newHead, id));
        assertFalse(registry.isDepartmentHead(head, id));
    }
}
