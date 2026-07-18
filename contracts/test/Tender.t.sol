// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovRegistry.sol";
import "../src/Tender.sol";

contract TenderTest is Test {
    GovRegistry registry;
    Tender tender;

    address admin = address(0xA11CE);
    address head = address(0xB0B);
    address official = address(0xC0C0);
    address vendorA = address(0xD001);
    address vendorB = address(0xD002);
    address stranger = address(0xF00F);

    uint256 deptId;

    function setUp() public {
        registry = new GovRegistry(admin);
        tender = new Tender(address(registry));

        vm.prank(admin);
        deptId = registry.createDepartment("Ministry of Infrastructure", head);

        vm.prank(head);
        registry.addOfficial(official, "Engineer Thapa", deptId);
    }

    function _createOpenTender() internal returns (uint256 tenderId) {
        vm.prank(official);
        tenderId = tender.createTender(deptId, 0, "Bridge repair contract", "desc", 500 ether, block.timestamp + 7 days);
    }

    function test_OfficialCanCreateTender() public {
        uint256 id = _createOpenTender();
        Tender.TenderInfo memory t = tender.getTender(id);
        assertEq(t.title, "Bridge repair contract");
        assertEq(uint256(t.status), uint256(Tender.TenderStatus.Open));
    }

    function test_StrangerCannotCreateTender() public {
        vm.prank(stranger);
        vm.expectRevert(bytes("Tender: not authorized for department"));
        tender.createTender(deptId, 0, "x", "y", 1 ether, block.timestamp + 1 days);
    }

    function test_AnyoneCanBid() public {
        uint256 id = _createOpenTender();

        vm.prank(vendorA);
        tender.submitBid(id, 480 ether, "We can do it for less");

        vm.prank(vendorB);
        tender.submitBid(id, 460 ether, "Even less, faster too");

        Tender.Bid[] memory bids = tender.getBids(id);
        assertEq(bids.length, 2);
        assertEq(bids[0].bidder, vendorA);
        assertEq(bids[1].amount, 460 ether);
    }

    function test_CannotBidAfterDeadline() public {
        vm.prank(official);
        uint256 id = tender.createTender(deptId, 0, "x", "y", 100 ether, block.timestamp + 1 days);

        vm.warp(block.timestamp + 2 days);

        vm.prank(vendorA);
        vm.expectRevert(bytes("Tender: submission deadline has passed"));
        tender.submitBid(id, 90 ether, "late bid");
    }

    function test_CannotBidOnClosedTender() public {
        uint256 id = _createOpenTender();

        vm.prank(official);
        tender.closeBidding(id);

        vm.prank(vendorA);
        vm.expectRevert(bytes("Tender: not open for bidding"));
        tender.submitBid(id, 100 ether, "too late");
    }

    function test_MustCloseBeforeAwarding() public {
        uint256 id = _createOpenTender();

        vm.prank(vendorA);
        tender.submitBid(id, 480 ether, "bid");

        vm.prank(official);
        vm.expectRevert(bytes("Tender: close bidding before awarding"));
        tender.awardTender(id, 0);
    }

    function test_AwardTenderToWinningBid() public {
        uint256 id = _createOpenTender();

        vm.prank(vendorA);
        tender.submitBid(id, 480 ether, "bid A");
        vm.prank(vendorB);
        tender.submitBid(id, 460 ether, "bid B");

        vm.prank(official);
        tender.closeBidding(id);

        vm.prank(official);
        tender.awardTender(id, 1);

        Tender.TenderInfo memory t = tender.getTender(id);
        assertEq(uint256(t.status), uint256(Tender.TenderStatus.Awarded));
        assertEq(t.awardedBidder, vendorB);
        assertEq(t.awardedAmount, 460 ether);
    }

    function test_StrangerCannotAward() public {
        uint256 id = _createOpenTender();
        vm.prank(vendorA);
        tender.submitBid(id, 480 ether, "bid A");
        vm.prank(official);
        tender.closeBidding(id);

        vm.prank(stranger);
        vm.expectRevert(bytes("Tender: not authorized for department"));
        tender.awardTender(id, 0);
    }

    function test_CancelTender() public {
        uint256 id = _createOpenTender();

        vm.prank(head);
        tender.cancelTender(id);

        Tender.TenderInfo memory t = tender.getTender(id);
        assertEq(uint256(t.status), uint256(Tender.TenderStatus.Cancelled));
    }

    function test_CannotCancelAwardedTender() public {
        uint256 id = _createOpenTender();
        vm.prank(vendorA);
        tender.submitBid(id, 480 ether, "bid A");
        vm.prank(official);
        tender.closeBidding(id);
        vm.prank(official);
        tender.awardTender(id, 0);

        vm.prank(official);
        vm.expectRevert(bytes("Tender: cannot cancel from this state"));
        tender.cancelTender(id);
    }

    function test_DepartmentTenderIdsAreTracked() public {
        uint256 id1 = _createOpenTender();
        vm.prank(official);
        uint256 id2 = tender.createTender(deptId, 0, "Second tender", "desc", 100 ether, block.timestamp + 3 days);

        uint256[] memory ids = tender.getDepartmentTenderIds(deptId);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }
}
