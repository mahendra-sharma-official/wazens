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
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        assertEq(id, 1);
        GovRegistry.Department memory dept = registry.getDepartment(id);
        assertEq(dept.name, "Ministry of Health");
        assertEq(dept.head, head);
        assertTrue(registry.isDepartmentHead(head, id));
    }

    function test_NonAdminCannotCreateDepartment() public {
        vm.prank(stranger);
        vm.expectRevert();
        registry.createDepartment("Ministry of Health", head, "Dr. Head Person");
    }

    function test_DepartmentHeadCanAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);

        assertTrue(registry.isOfficialOfDepartment(official, id));
        assertTrue(registry.isAuthorizedForDepartment(official, id));
    }

    function test_StrangerCannotAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.prank(stranger);
        vm.expectRevert();
        registry.addOfficial(official, "Dr. Sharma", id);
    }

    function test_AdminCanAlsoAddOfficial() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.prank(admin);
        registry.addOfficial(official, "Dr. Sharma", id);

        assertTrue(registry.isOfficialOfDepartment(official, id));
    }

    function test_DeactivateOfficialRemovesAuthorization() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

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
        uint256 healthId = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");
        address otherHead = address(0xE0E0);
        uint256 infraId = registry.createDepartment("Ministry of Infrastructure", otherHead, "Engineer Other Head");
        vm.stopPrank();

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", healthId);

        assertTrue(registry.isAuthorizedForDepartment(official, healthId));
        assertFalse(registry.isAuthorizedForDepartment(official, infraId));
    }

    function test_ChangeDepartmentHead() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        address newHead = address(0xF00F);
        vm.prank(admin);
        registry.changeDepartmentHead(id, newHead, "New Head Name");

        assertTrue(registry.isDepartmentHead(newHead, id));
        assertFalse(registry.isDepartmentHead(head, id));
        GovRegistry.Department memory dept = registry.getDepartment(id);
        assertEq(dept.headName, "New Head Name");
    }

    function test_DepartmentTracksHeadName() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");
        GovRegistry.Department memory dept = registry.getDepartment(id);
        assertEq(dept.headName, "Dr. Head Person");
    }

    function test_OfficialRecordsWhoAddedThemAndWhen() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.warp(1000);
        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);

        GovRegistry.OfficialInfo memory info = registry.getOfficial(official);
        assertEq(info.addedBy, head);
        assertEq(info.addedAt, 1000);
        assertEq(info.deactivatedBy, address(0));
    }

    function test_OfficialRecordsWhoDeactivatedThemAndWhen() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);

        vm.warp(2000);
        vm.prank(admin);
        registry.deactivateOfficial(official);

        GovRegistry.OfficialInfo memory info = registry.getOfficial(official);
        assertFalse(info.active);
        assertEq(info.deactivatedBy, admin);
        assertEq(info.deactivatedAt, 2000);
    }

    function test_DepartmentOfficialsIncludesInactiveForHistory() public {
        vm.prank(admin);
        uint256 id = registry.createDepartment("Ministry of Health", head, "Dr. Head Person");

        vm.prank(head);
        registry.addOfficial(official, "Dr. Sharma", id);
        vm.prank(head);
        registry.deactivateOfficial(official);

        address[] memory all = registry.getDepartmentOfficials(id);
        assertEq(all.length, 1);
        assertEq(all[0], official);
    }
}
