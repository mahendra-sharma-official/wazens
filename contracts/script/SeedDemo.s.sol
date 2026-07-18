// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";
import "../src/Tender.sol";

/// @notice Populates freshly deployed contracts with a varied demo
///         dataset: four departments, a project and a tender in each
///         (in different states, so the UI has something to show for
///         every status), and a few citizen reports. Every account
///         used here is derived from anvil's well known default test
///         mnemonic, the same one anvil itself uses to fund accounts
///         0..N, so nothing needs to be passed in beyond the contract
///         addresses and which account deployed them.
///
///         Needs anvil started with at least 13 accounts, i.e.
///         `anvil --accounts 16` (scripts/start-chain.sh and
///         scripts/run-local.sh already do this).
///
///         Run with:
///         forge script script/SeedDemo.s.sol --rpc-url anvil --broadcast
contract SeedDemo is Script {
    string constant MNEMONIC = "test test test test test test test test test test test junk";

    function _key(uint32 index) internal pure returns (uint256) {
        return vm.deriveKey(MNEMONIC, index);
    }

    function run() external {
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        address ledgerAddr = vm.envAddress("LEDGER_ADDRESS");
        address tenderAddr = vm.envAddress("TENDER_ADDRESS");

        GovRegistry registry = GovRegistry(registryAddr);
        ProjectLedger ledger = ProjectLedger(ledgerAddr);
        Tender tender = Tender(tenderAddr);

        uint256 adminKey = _key(0);

        // Index layout: 0 admin, then (head, official) pairs per
        // department, then one citizen, then three vendors that bid
        // across multiple tenders.
        uint256[4] memory headKeys = [_key(1), _key(3), _key(5), _key(7)];
        uint256[4] memory officialKeys = [_key(2), _key(4), _key(6), _key(8)];
        address[4] memory headAddrs;
        address[4] memory officialAddrs;
        for (uint256 i = 0; i < 4; i++) {
            headAddrs[i] = vm.addr(headKeys[i]);
            officialAddrs[i] = vm.addr(officialKeys[i]);
        }

        uint256 citizenKey = _key(9);
        uint256 vendorAKey = _key(10);
        uint256 vendorBKey = _key(11);
        uint256 vendorCKey = _key(12);

        string[4] memory deptNames = [
            "Ministry of Infrastructure",
            "Ministry of Health",
            "Ministry of Education",
            "Ministry of Water Supply and Sanitation"
        ];
        string[4] memory officialNames = [
            "Engineer Rana Thapa",
            "Dr. Anjali Sharma",
            "Principal Bikash Karki",
            "Engineer Sunita Magar"
        ];

        uint256[4] memory deptIds;
        vm.startBroadcast(adminKey);
        for (uint256 i = 0; i < 4; i++) {
            deptIds[i] = registry.createDepartment(deptNames[i], headAddrs[i]);
        }
        vm.stopBroadcast();

        for (uint256 i = 0; i < 4; i++) {
            vm.broadcast(headKeys[i]);
            registry.addOfficial(officialAddrs[i], officialNames[i], deptIds[i]);
        }

        _seedInfrastructure(ledger, tender, deptIds[0], officialAddrs[0], officialKeys[0], headKeys[0]);
        _seedHealth(ledger, tender, deptIds[1], officialAddrs[1], officialKeys[1]);
        _seedEducation(ledger, tender, deptIds[2], officialAddrs[2], officialKeys[2]);
        _seedWater(ledger, tender, deptIds[3], officialAddrs[3], officialKeys[3]);

        // Vendors bid across a few of the open tenders.
        uint256[4] memory infraTenders = tenderIdsFor(tender, deptIds[0]);
        uint256[4] memory healthTenders = tenderIdsFor(tender, deptIds[1]);
        uint256[4] memory eduTenders = tenderIdsFor(tender, deptIds[2]);

        vm.broadcast(vendorAKey);
        tender.submitBid(infraTenders[0], 280 ether, "Certified structural steel, delivery within 3 weeks.");
        vm.broadcast(vendorBKey);
        tender.submitBid(infraTenders[0], 290 ether, "Premium grade steel with 10 year warranty.");

        vm.broadcast(vendorBKey);
        tender.submitBid(healthTenders[0], 140 ether, "Full equipment package including maintenance contract.");
        vm.broadcast(vendorCKey);
        tender.submitBid(healthTenders[0], 145 ether, "Equipment package with extended warranty.");
        vm.startBroadcast(officialKeys[1]);
        tender.closeBidding(healthTenders[0]);
        tender.awardTender(healthTenders[0], 0); // vendorB, lowest bid
        vm.stopBroadcast();

        vm.broadcast(vendorAKey);
        tender.submitBid(eduTenders[0], 75 ether, "Printed locally, 6 week turnaround.");
        vm.broadcast(vendorCKey);
        tender.submitBid(eduTenders[0], 78 ether, "Includes digital copies at no extra cost.");
        vm.broadcast(officialKeys[2]);
        tender.closeBidding(eduTenders[0]); // closed, not yet awarded

        // Citizen activity, spread across departments.
        vm.startBroadcast(citizenKey);
        ledger.fileCitizenReport(
            projectIdsFor(ledger, deptIds[0])[0],
            "The survey markers near the Koteshwor stretch look untouched as of this week."
        );
        uint256 clinicProjectId = projectIdsFor(ledger, deptIds[1])[0];
        uint256 clinicReportIndex =
            ledger.fileCitizenReport(clinicProjectId, "Renovation looks complete from the outside, thank you for the update.");
        ledger.fileCitizenReport(
            projectIdsFor(ledger, deptIds[2])[0], "Construction fencing has blocked the school's main gate for two weeks."
        );
        vm.stopBroadcast();

        vm.broadcast(officialKeys[1]);
        ledger.updateReportStatus(clinicProjectId, clinicReportIndex, ProjectLedger.ReportStatus.Resolved);

        console.log("Infrastructure/Health/Education/Water department IDs:");
        console.log(deptIds[0], deptIds[1]);
        console.log(deptIds[2], deptIds[3]);
    }

    function _seedInfrastructure(
        ProjectLedger ledger,
        Tender tender,
        uint256 deptId,
        address official,
        uint256 officialKey,
        uint256 headKey
    ) internal {
        vm.startBroadcast(officialKey);
        uint256 roadProject = ledger.createProject(
            "Ring Road Expansion Phase 2",
            "Widening and repair of the ring road section near Koteshwor",
            deptId,
            official,
            1000 ether
        );
        ledger.setProjectStatus(roadProject, ProjectLedger.ProjectStatus.Ongoing);
        uint256 m1 = ledger.addMilestone(roadProject, "Complete survey and design", block.timestamp + 30 days);
        ledger.addMilestone(roadProject, "Complete phase 1 excavation", block.timestamp + 90 days);
        ledger.completeMilestone(roadProject, m1, "ipfs://demo-survey-report");
        ledger.recordSpending(roadProject, 150 ether, "Survey and design contract payment", official);
        ledger.recordSpending(roadProject, 220 ether, "Phase 1 excavation contractor advance", official);

        tender.createTender(
            deptId,
            roadProject,
            "Bridge Reinforcement Steel Supply",
            "Structural steel for the Koteshwor bridge reinforcement works",
            300 ether,
            block.timestamp + 14 days
        );
        vm.stopBroadcast();

        // A second, older tender that ended up cancelled, so the UI
        // has an example of that state too.
        vm.startBroadcast(headKey);
        uint256 oldTender = tender.createTender(
            deptId, 0, "Temporary Signage Contract", "Superseded by the main contractor's own signage plan", 20 ether, block.timestamp + 5 days
        );
        tender.cancelTender(oldTender);
        vm.stopBroadcast();
    }

    function _seedHealth(ProjectLedger ledger, Tender tender, uint256 deptId, address official, uint256 officialKey)
        internal
    {
        vm.startBroadcast(officialKey);
        uint256 clinicProject = ledger.createProject(
            "Rural Health Post Renovation - Sindhupalchok",
            "Renovation and equipment upgrade for the district health post",
            deptId,
            official,
            400 ether
        );
        ledger.setProjectStatus(clinicProject, ProjectLedger.ProjectStatus.Completed);
        uint256 hm1 = ledger.addMilestone(clinicProject, "Roof and structural repair", block.timestamp - 20 days);
        ledger.completeMilestone(clinicProject, hm1, "ipfs://demo-clinic-repair-photos");
        ledger.recordSpending(clinicProject, 380 ether, "Contractor final payment", official);

        tender.createTender(
            deptId, clinicProject, "Medical Equipment Procurement", "Diagnostic and basic surgical equipment for the renovated health post", 150 ether, block.timestamp + 10 days
        );
        vm.stopBroadcast();
    }

    function _seedEducation(ProjectLedger ledger, Tender tender, uint256 deptId, address official, uint256 officialKey)
        internal
    {
        vm.startBroadcast(officialKey);
        uint256 schoolProject = ledger.createProject(
            "Community School Block Construction - Bhaktapur",
            "New two storey classroom block for the community secondary school",
            deptId,
            official,
            600 ether
        );
        ledger.setProjectStatus(schoolProject, ProjectLedger.ProjectStatus.Ongoing);
        uint256 sm1 = ledger.addMilestone(schoolProject, "Foundation and ground floor structure", block.timestamp + 40 days);
        ledger.completeMilestone(schoolProject, sm1, "ipfs://demo-foundation-photos");
        ledger.recordSpending(schoolProject, 200 ether, "Foundation contractor first installment", official);

        tender.createTender(
            deptId, schoolProject, "Textbook Printing and Supply", "Printing and delivery of updated grade 6-8 textbooks", 80 ether, block.timestamp + 5 days
        );
        vm.stopBroadcast();
    }

    function _seedWater(ProjectLedger ledger, Tender tender, uint256 deptId, address official, uint256 officialKey)
        internal
    {
        vm.startBroadcast(officialKey);
        uint256 waterProject = ledger.createProject(
            "Rural Drinking Water Pipeline - Dolakha",
            "New gravity fed pipeline bringing drinking water to four wards",
            deptId,
            official,
            350 ether
        );

        tender.createTender(
            deptId, waterProject, "HDPE Pipe Supply Contract", "Supply of HDPE pipes and fittings for the Dolakha pipeline", 120 ether, block.timestamp + 20 days
        );
        vm.stopBroadcast();
    }

    function tenderIdsFor(Tender tender, uint256 deptId) internal view returns (uint256[4] memory ids) {
        uint256[] memory all = tender.getDepartmentTenderIds(deptId);
        for (uint256 i = 0; i < all.length && i < 4; i++) {
            ids[i] = all[i];
        }
    }

    function projectIdsFor(ProjectLedger ledger, uint256 deptId) internal view returns (uint256[4] memory ids) {
        uint256[] memory all = ledger.getDepartmentProjectIds(deptId);
        for (uint256 i = 0; i < all.length && i < 4; i++) {
            ids[i] = all[i];
        }
    }
}
