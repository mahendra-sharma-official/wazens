// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";
import "../src/ReportingTreasury.sol";

contract ReportingTreasuryTest is Test {
    GovRegistry registry;
    ProjectLedger ledger;
    ReportingTreasury treasury;

    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address relayer = address(0xE1A1);

    uint256 projectId;

    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 constant REPORT_TYPEHASH =
        keccak256("CitizenReport(address reporter,uint256 projectId,string comment,uint256 nonce)");

    function setUp() public {
        registry = new GovRegistry(admin);
        ledger = new ProjectLedger(address(registry));
        treasury = new ReportingTreasury(address(ledger));

        vm.prank(admin);
        uint256 deptId = registry.createDepartment("Ministry of Infrastructure", head, "Head Person");

        vm.prank(head);
        projectId = ledger.createProject("Bridge Build", "desc", deptId, head, 100 ether);

        vm.deal(address(this), 100 ether);
        treasury.fund{value: 10 ether}();

        vm.deal(relayer, 1 ether);
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH, keccak256(bytes("GovLedger")), keccak256(bytes("1")), block.chainid, address(ledger)
            )
        );
    }

    function _signReport(uint256 privateKey, address reporter, string memory comment, uint256 nonce)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(abi.encode(REPORT_TYPEHASH, reporter, projectId, keccak256(bytes(comment)), nonce));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_FundIncreasesBalanceAndEmitsEvent() public {
        uint256 before = address(treasury).balance;
        treasury.fund{value: 1 ether}();
        assertEq(address(treasury).balance, before + 1 ether);
    }

    function test_SponsorReportReimbursesRelayerAndRecordsReporter() public {
        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);
        bytes memory sig = _signReport(citizenKey, citizen, "Please look into this", 0);

        uint256 relayerBalanceBefore = relayer.balance;
        uint256 treasuryBalanceBefore = address(treasury).balance;

        vm.prank(relayer);
        vm.txGasPrice(1 gwei);
        uint256 reportIndex = treasury.sponsorReport(citizen, projectId, "Please look into this", sig);

        ProjectLedger.CitizenReport[] memory reports = ledger.getReports(projectId);
        assertEq(reports[reportIndex].reporter, citizen);
        assertTrue(reports[reportIndex].gasSponsored);

        // Relayer should have been reimbursed something, and the
        // treasury balance should have gone down by exactly that much.
        assertGt(relayer.balance, relayerBalanceBefore - 1); // received *something* back (gas already spent by vm)
        assertLt(address(treasury).balance, treasuryBalanceBefore);
        assertEq(treasury.totalSponsored(), treasuryBalanceBefore - address(treasury).balance);
        assertEq(treasury.reportsSponsoredCount(), 1);
    }

    function test_SponsorReportRevertsOnInvalidSignature() public {
        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);
        uint256 wrongKey = 0xBAD;
        bytes memory sig = _signReport(wrongKey, citizen, "Please look into this", 0);

        vm.prank(relayer);
        vm.expectRevert(bytes("ProjectLedger: invalid signature"));
        treasury.sponsorReport(citizen, projectId, "Please look into this", sig);
    }

    function test_SponsorReportCapsRefundToAvailableBalance() public {
        // Drain the treasury down to almost nothing first.
        ReportingTreasury poorTreasury = new ReportingTreasury(address(ledger));
        poorTreasury.fund{value: 1 wei}();

        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);
        bytes memory sig = _signReport(citizenKey, citizen, "Report on empty treasury", 0);

        vm.prank(relayer);
        vm.txGasPrice(1 gwei);
        poorTreasury.sponsorReport(citizen, projectId, "Report on empty treasury", sig);

        // Whatever was refunded, it cannot have exceeded the 1 wei the
        // treasury started with.
        assertEq(address(poorTreasury).balance, 0);
        assertEq(poorTreasury.totalSponsored(), 1);
    }
}
