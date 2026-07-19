// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";

contract ProjectLedgerTest is Test {
    GovRegistry registry;
    ProjectLedger ledger;

    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address official = address(0xC0C0);
    address stranger = address(0xD00D);
    address recipient = address(0x1234);

    uint256 deptId;

    function setUp() public {
        registry = new GovRegistry(admin);
        ledger = new ProjectLedger(address(registry));

        vm.prank(admin);
        deptId = registry.createDepartment("Ministry of Infrastructure", head, "Engineer Thapa Head");

        vm.prank(head);
        registry.addOfficial(official, "Engineer Thapa", deptId);
    }

    function test_HeadCanCreateProject() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        ProjectLedger.Project memory p = ledger.getProject(projectId);
        assertEq(p.name, "Bridge Build");
        assertEq(p.responsibleOfficial, official);
        assertEq(p.allocatedBudget, 100 ether);
        assertEq(p.spentBudget, 0);
        assertEq(uint256(p.status), uint256(ProjectLedger.ProjectStatus.Planned));
    }

    function test_OfficialCanAlsoCreateProject() public {
        vm.prank(official);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);
        assertEq(projectId, 1);
    }

    function test_StrangerCannotCreateProject() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("ProjectLedger: not authorized for department"));
        ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);
    }

    function test_ResponsibleOfficialMustBelongToDepartment() public {
        address outsider = address(0x9999);
        vm.prank(head);
        vm.expectRevert(bytes("ProjectLedger: responsible official must belong to department"));
        ledger.createProject("Bridge Build", "desc", deptId, outsider, 100 ether);
    }

    function test_AddAndCompleteMilestone() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(official);
        uint256 mIndex = ledger.addMilestone(projectId, "Finish survey", block.timestamp + 10 days);

        ProjectLedger.Milestone[] memory milestones = ledger.getMilestones(projectId);
        assertEq(milestones.length, 1);
        assertFalse(milestones[0].completed);

        vm.prank(official);
        ledger.completeMilestone(projectId, mIndex, "ipfs://evidence");

        milestones = ledger.getMilestones(projectId);
        assertTrue(milestones[0].completed);
        assertEq(milestones[0].evidenceURI, "ipfs://evidence");
        assertEq(milestones[0].completedBy, official);
    }

    function test_CannotCompleteMilestoneTwice() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(official);
        uint256 mIndex = ledger.addMilestone(projectId, "Finish survey", block.timestamp + 10 days);

        vm.prank(official);
        ledger.completeMilestone(projectId, mIndex, "ipfs://evidence");

        vm.prank(official);
        vm.expectRevert(bytes("ProjectLedger: milestone already completed"));
        ledger.completeMilestone(projectId, mIndex, "ipfs://evidence2");
    }

    function test_RecordSpendingWithinBudget() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(official);
        ledger.recordSpending(projectId, 40 ether, "Cement purchase", recipient);

        ProjectLedger.Project memory p = ledger.getProject(projectId);
        assertEq(p.spentBudget, 40 ether);

        ProjectLedger.SpendingRecord[] memory records = ledger.getSpendingRecords(projectId);
        assertEq(records.length, 1);
        assertEq(records[0].amount, 40 ether);
        assertEq(records[0].recordedBy, official);
    }

    function test_CannotSpendMoreThanAllocatedBudget() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(official);
        vm.expectRevert(bytes("ProjectLedger: exceeds allocated budget"));
        ledger.recordSpending(projectId, 150 ether, "Too much", recipient);
    }

    function test_StrangerCannotRecordSpending() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(stranger);
        vm.expectRevert(bytes("ProjectLedger: not authorized for department"));
        ledger.recordSpending(projectId, 10 ether, "Bribe", recipient);
    }

    function test_AnyoneCanFileCitizenReport() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(stranger);
        ledger.fileCitizenReport(projectId, "This bridge looks unfinished but marked ongoing");

        ProjectLedger.CitizenReport[] memory reports = ledger.getReports(projectId);
        assertEq(reports.length, 1);
        assertEq(reports[0].reporter, stranger);
        assertFalse(reports[0].gasSponsored);
    }

    // ---- EIP-712 gasless reporting ----

    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant REPORT_TYPEHASH =
        keccak256("CitizenReport(address reporter,uint256 projectId,string comment,uint256 nonce)");

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes("GovLedger")), keccak256(bytes("1")), block.chainid, address(ledger)
            )
        );
    }

    function _signReport(uint256 privateKey, address reporter, uint256 projectId, string memory comment, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(REPORT_TYPEHASH, reporter, projectId, keccak256(bytes(comment)), nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_FileCitizenReportBySignature() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);
        bytes memory sig = _signReport(citizenKey, citizen, projectId, "Signed report, no gas from me", 0);

        // A relayer (any address, doesn't need to be citizen) submits it.
        vm.prank(stranger);
        uint256 reportIndex = ledger.fileCitizenReportBySignature(citizen, projectId, "Signed report, no gas from me", sig);

        ProjectLedger.CitizenReport[] memory reports = ledger.getReports(projectId);
        assertEq(reports[reportIndex].reporter, citizen);
        assertTrue(reports[reportIndex].gasSponsored);
        assertEq(ledger.reportNonces(citizen), 1);
    }

    function test_CannotReplaySignedReport() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);
        bytes memory sig = _signReport(citizenKey, citizen, projectId, "Report", 0);

        ledger.fileCitizenReportBySignature(citizen, projectId, "Report", sig);

        vm.expectRevert(bytes("ProjectLedger: invalid signature"));
        ledger.fileCitizenReportBySignature(citizen, projectId, "Report", sig);
    }

    function test_CannotForgeSignedReportFromSomeoneElse() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        uint256 attackerKey = 0xBAD;
        address victim = address(0x1234567890123456789012345678901234567890);

        // Attacker signs, but claims to be the victim.
        bytes memory sig = _signReport(attackerKey, victim, projectId, "Fake report", 0);

        vm.expectRevert(bytes("ProjectLedger: invalid signature"));
        ledger.fileCitizenReportBySignature(victim, projectId, "Fake report", sig);
    }

    function test_SetProjectStatus() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(official);
        ledger.setProjectStatus(projectId, ProjectLedger.ProjectStatus.Ongoing);

        ProjectLedger.Project memory p = ledger.getProject(projectId);
        assertEq(uint256(p.status), uint256(ProjectLedger.ProjectStatus.Ongoing));
    }

    function test_NewReportDefaultsToOpenStatus() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(stranger);
        ledger.fileCitizenReport(projectId, "Looks unfinished");

        ProjectLedger.CitizenReport[] memory reports = ledger.getReports(projectId);
        assertEq(uint256(reports[0].status), uint256(ProjectLedger.ReportStatus.Open));
        assertEq(reports[0].triagedBy, address(0));
    }

    function test_OfficialCanTriageReport() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(stranger);
        ledger.fileCitizenReport(projectId, "Looks unfinished");

        vm.prank(official);
        ledger.updateReportStatus(projectId, 0, ProjectLedger.ReportStatus.UnderReview);

        ProjectLedger.CitizenReport[] memory reports = ledger.getReports(projectId);
        assertEq(uint256(reports[0].status), uint256(ProjectLedger.ReportStatus.UnderReview));
        assertEq(reports[0].triagedBy, official);
        assertGt(reports[0].triagedAt, 0);
    }

    function test_StrangerCannotTriageReport() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        vm.prank(stranger);
        ledger.fileCitizenReport(projectId, "Looks unfinished");

        vm.prank(stranger);
        vm.expectRevert(bytes("ProjectLedger: not authorized for department"));
        ledger.updateReportStatus(projectId, 0, ProjectLedger.ReportStatus.Dismissed);
    }

    function test_DepartmentProjectIdsAreTracked() public {
        vm.startPrank(head);
        uint256 p1 = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);
        uint256 p2 = ledger.createProject("Road Repair", "desc", deptId, official, 50 ether);
        vm.stopPrank();

        uint256[] memory ids = ledger.getDepartmentProjectIds(deptId);
        assertEq(ids.length, 2);
        assertEq(ids[0], p1);
        assertEq(ids[1], p2);
    }

    function test_ChangeResponsibleOfficial() public {
        vm.prank(head);
        uint256 projectId = ledger.createProject("Bridge Build", "desc", deptId, official, 100 ether);

        address newOfficial = address(0x5555);
        vm.prank(head);
        registry.addOfficial(newOfficial, "Engineer Gurung", deptId);

        vm.prank(head);
        ledger.changeResponsibleOfficial(projectId, newOfficial);

        ProjectLedger.Project memory p = ledger.getProject(projectId);
        assertEq(p.responsibleOfficial, newOfficial);
    }
}
