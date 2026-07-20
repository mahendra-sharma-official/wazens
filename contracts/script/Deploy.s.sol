// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";
import "../src/Tender.sol";
import "../src/ReportingTreasury.sol";

/// @notice Deploys GovRegistry, ProjectLedger, Tender, and
///         ReportingTreasury, wired together, then seeds the treasury
///         with some ETH so gasless citizen reports work immediately.
///         Run with: forge script script/Deploy.s.sol --rpc-url anvil --broadcast
contract Deploy is Script {
    function run()
        external
        returns (
            GovRegistry registry,
            ProjectLedger ledger,
            Tender tender,
            ReportingTreasury treasury
        )
    {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        registry = new GovRegistry(deployer);
        ledger = new ProjectLedger(address(registry));
        tender = new Tender(address(registry));
        treasury = new ReportingTreasury(address(ledger));

        uint256 initialFunding = block.chainid == 31337 ? 5 ether : 0.01 ether;

        treasury.fund{value: initialFunding}();

        vm.stopBroadcast();

        console.log("Deployer:", deployer);
        console.log("GovRegistry deployed at:", address(registry));
        console.log("ProjectLedger deployed at:", address(ledger));
        console.log("Tender deployed at:", address(tender));
        console.log("ReportingTreasury deployed at:", address(treasury));
    }
}
