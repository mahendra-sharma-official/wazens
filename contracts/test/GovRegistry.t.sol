// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";

// test contract for GovRegistry.
contract GovRegistryTest is Test {
    // instance of the registry contract.
    GovRegistry registry;

    // test accounts.
    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address official = address(0xC0C0);
    address stranger = address(0xD00D);

    // deploy a fresh registry before each test.
    function setUp() public {
        registry = new GovRegistry(admin);
    }

    // verifies that an admin can create a department.
    function test_AdminCanCreateDepartment() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        assertEq(id, 1);

        GovRegistry.Department memory dept =
            registry.getDepartment(id);

        assertEq(dept.name, "Ministry of Health");
        assertEq(dept.head, head);
        assertTrue(registry.isDepartmentHead(head, id));
    }

    // verifies that non-admins cannot create departments.
    function test_NonAdminCannotCreateDepartment() public {
        vm.prank(stranger);

        vm.expectRevert();

        registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );
    }

    // verifies that a department head can add officials.
    function test_DepartmentHeadCanAddOfficial() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        assertTrue(
            registry.isOfficialOfDepartment(
                official,
                id
            )
        );

        assertTrue(
            registry.isAuthorizedForDepartment(
                official,
                id
            )
        );
    }

    // verifies that strangers cannot add officials.
    function test_StrangerCannotAddOfficial() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(stranger);

        vm.expectRevert();

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );
    }

    // verifies that admins can also add officials.
    function test_AdminCanAlsoAddOfficial() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(admin);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        assertTrue(
            registry.isOfficialOfDepartment(
                official,
                id
            )
        );
    }

    // verifies that deactivated officials lose authorization.
    function test_DeactivateOfficialRemovesAuthorization() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        assertTrue(
            registry.isOfficialOfDepartment(
                official,
                id
            )
        );

        vm.prank(head);

        registry.deactivateOfficial(official);

        assertFalse(
            registry.isOfficialOfDepartment(
                official,
                id
            )
        );

        assertFalse(
            registry.isAuthorizedForDepartment(
                official,
                id
            )
        );
    }

    // verifies that officials are only authorized in their own department.
    function test_OfficialFromOtherDepartmentIsNotAuthorized() public {
        vm.startPrank(admin);

        uint256 healthId = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        address otherHead = address(0xE0E0);

        uint256 infraId = registry.createDepartment(
            "Ministry of Infrastructure",
            otherHead,
            "Engineer Other Head"
        );

        vm.stopPrank();

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            healthId
        );

        assertTrue(
            registry.isAuthorizedForDepartment(
                official,
                healthId
            )
        );

        assertFalse(
            registry.isAuthorizedForDepartment(
                official,
                infraId
            )
        );
    }

    // verifies that department heads can be changed.
    function test_ChangeDepartmentHead() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        address newHead = address(0xF00F);

        vm.prank(admin);

        registry.changeDepartmentHead(
            id,
            newHead,
            "New Head Name"
        );

        assertTrue(
            registry.isDepartmentHead(
                newHead,
                id
            )
        );

        assertFalse(
            registry.isDepartmentHead(
                head,
                id
            )
        );

        GovRegistry.Department memory dept =
            registry.getDepartment(id);

        assertEq(
            dept.headName,
            "New Head Name"
        );
    }

    // verifies that head names are stored correctly.
    function test_DepartmentTracksHeadName() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        GovRegistry.Department memory dept =
            registry.getDepartment(id);

        assertEq(
            dept.headName,
            "Dr. Head Person"
        );
    }

    // verifies that official creation history is recorded.
    function test_OfficialRecordsWhoAddedThemAndWhen() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.warp(1000);

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        GovRegistry.OfficialInfo memory info =
            registry.getOfficial(official);

        assertEq(info.addedBy, head);
        assertEq(info.addedAt, 1000);
        assertEq(info.deactivatedBy, address(0));
    }

    // verifies that deactivation history is recorded.
    function test_OfficialRecordsWhoDeactivatedThemAndWhen() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        vm.warp(2000);

        vm.prank(admin);

        registry.deactivateOfficial(official);

        GovRegistry.OfficialInfo memory info =
            registry.getOfficial(official);

        assertFalse(info.active);
        assertEq(info.deactivatedBy, admin);
        assertEq(info.deactivatedAt, 2000);
    }

    // verifies that department history includes inactive officials.
    function test_DepartmentOfficialsIncludesInactiveForHistory() public {
        vm.prank(admin);

        uint256 id = registry.createDepartment(
            "Ministry of Health",
            head,
            "Dr. Head Person"
        );

        vm.prank(head);

        registry.addOfficial(
            official,
            "Dr. Sharma",
            id
        );

        vm.prank(head);

        registry.deactivateOfficial(official);

        address[] memory all =
            registry.getDepartmentOfficials(id);

        assertEq(all.length, 1);
        assertEq(all[0], official);
    }
}