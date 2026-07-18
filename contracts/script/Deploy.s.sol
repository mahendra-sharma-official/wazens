// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/GovRegistry.sol";
import "../src/ProjectLedger.sol";
import "../src/Tender.sol";

/// @notice Deploys GovRegistry, ProjectLedger, and Tender, wired together.
///         Run with: forge script script/Deploy.s.sol --rpc-url anvil --broadcast
contract Deploy is Script {
    function run() external returns (GovRegistry registry, ProjectLedger ledger, Tender tender) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        registry = new GovRegistry(deployer);
        ledger = new ProjectLedger(address(registry));
        tender = new Tender(address(registry));

        vm.stopBroadcast();

        console.log("Deployer:", deployer);
        console.log("GovRegistry deployed at:", address(registry));
        console.log("ProjectLedger deployed at:", address(ledger));
        console.log("Tender deployed at:", address(tender));
    }
}
