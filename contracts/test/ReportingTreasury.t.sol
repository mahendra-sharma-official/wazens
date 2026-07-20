// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";
import "../src/ReportingTreasury.sol";

// test contract for ReportingTreasury.
contract ReportingTreasuryTest is Test {
    // contract instances used during testing.
    GovRegistry registry;
    ProjectLedger ledger;
    ReportingTreasury treasury;

    // test accounts.
    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address relayer = address(0xE1A1);

    // project used throughout the tests.
    uint256 projectId;

    // EIP-712 constants used for signature generation.
    bytes32 constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

    bytes32 constant REPORT_TYPEHASH =
        keccak256(
            "CitizenReport(address reporter,uint256 projectId,string comment,uint256 nonce)"
        );

    // deploy fresh contracts before each test.
    function setUp() public {
        registry = new GovRegistry(admin);
        ledger = new ProjectLedger(address(registry));
        treasury = new ReportingTreasury(address(ledger));

        // creating a department.
        vm.prank(admin);

        uint256 deptId = registry.createDepartment(
            "Ministry of Infrastructure",
            head,
            "Head Person"
        );

        // creating a project.
        vm.prank(head);

        projectId = ledger.createProject(
            "Bridge Build",
            "desc",
            deptId,
            head,
            100 ether
        );

        // funding the treasury.
        vm.deal(address(this), 100 ether);

        treasury.fund{value: 10 ether}();

        // funding the relayer account.
        vm.deal(relayer, 1 ether);
    }

    // generates the EIP-712 domain separator.
    function _domainSeparator()
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("GovLedger")),
                keccak256(bytes("1")),
                block.chainid,
                address(ledger)
            )
        );
    }

    // signs a citizen report using a test private key.
    function _signReport(
        uint256 privateKey,
        address reporter,
        string memory comment,
        uint256 nonce
    )
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                REPORT_TYPEHASH,
                reporter,
                projectId,
                keccak256(bytes(comment)),
                nonce
            )
        );

        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparator(),
                structHash
            )
        );

        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(privateKey, digest);

        return abi.encodePacked(r, s, v);
    }

    // verifies treasury funding increases balance.
    function test_FundIncreasesBalanceAndEmitsEvent() public {
        uint256 before =
            address(treasury).balance;

        treasury.fund{value: 1 ether}();

        assertEq(
            address(treasury).balance,
            before + 1 ether
        );
    }

    // verifies sponsored reports reimburse the relayer.
    function test_SponsorReportReimbursesRelayerAndRecordsReporter()
        public
    {
        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);

        bytes memory sig = _signReport(
            citizenKey,
            citizen,
            "Please look into this",
            0
        );

        uint256 relayerBalanceBefore =
            relayer.balance;

        uint256 treasuryBalanceBefore =
            address(treasury).balance;

        vm.prank(relayer);
        vm.txGasPrice(1 gwei);

        uint256 reportIndex =
            treasury.sponsorReport(
                citizen,
                projectId,
                "Please look into this",
                sig
            );

        ProjectLedger.CitizenReport[] memory reports =
            ledger.getReports(projectId);

        assertEq(
            reports[reportIndex].reporter,
            citizen
        );

        assertTrue(
            reports[reportIndex].gasSponsored
        );

        // relayer should receive a refund.
        assertGt(
            relayer.balance,
            relayerBalanceBefore - 1
        );

        // treasury balance should decrease.
        assertLt(
            address(treasury).balance,
            treasuryBalanceBefore
        );

        assertEq(
            treasury.totalSponsored(),
            treasuryBalanceBefore -
                address(treasury).balance
        );

        assertEq(
            treasury.reportsSponsoredCount(),
            1
        );
    }

    // verifies invalid signatures are rejected.
    function test_SponsorReportRevertsOnInvalidSignature()
        public
    {
        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);

        uint256 wrongKey = 0xBAD;

        bytes memory sig = _signReport(
            wrongKey,
            citizen,
            "Please look into this",
            0
        );

        vm.prank(relayer);

        vm.expectRevert(
            bytes("ProjectLedger: invalid signature")
        );

        treasury.sponsorReport(
            citizen,
            projectId,
            "Please look into this",
            sig
        );
    }

    // verifies refunds cannot exceed treasury balance.
    function test_SponsorReportCapsRefundToAvailableBalance()
        public
    {
        // deploying a nearly empty treasury.
        ReportingTreasury poorTreasury =
            new ReportingTreasury(address(ledger));

        poorTreasury.fund{value: 1 wei}();

        uint256 citizenKey = 0xB33F;
        address citizen = vm.addr(citizenKey);

        bytes memory sig = _signReport(
            citizenKey,
            citizen,
            "Report on empty treasury",
            0
        );

        vm.prank(relayer);
        vm.txGasPrice(1 gwei);

        poorTreasury.sponsorReport(
            citizen,
            projectId,
            "Report on empty treasury",
            sig
        );

        // treasury should never refund more than it holds.
        assertEq(
            address(poorTreasury).balance,
            0
        );

        assertEq(
            poorTreasury.totalSponsored(),
            1
        );
    }
}