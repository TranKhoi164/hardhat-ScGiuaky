// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VestingToken is ERC20, Ownable {
    struct VestingSchedule {
        uint256 totalAmount;
        uint256 released;
        uint256 start;
        uint256 cliff;
        uint256 duration;
        bool revoked;
    }

    mapping(address => VestingSchedule) public vestingSchedules;
    mapping(address => bool) public isVesting;
    // commonly used as official burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    event TokensReleased(address beneficiary, uint256 amount);
    event VestingRevoked(address beneficiary);

    constructor() ERC20("VestingToken", "VEST") Ownable(address(this)) {
        _mint(msg.sender, 1000000 * 1e18);
    }

    function setVesting(
        address beneficiary,
        uint256 amount,
        uint256 start,
        uint256 cliff,
        uint256 duration
    ) external onlyOwner {
        require(!isVesting[beneficiary], "Vesting already exists");
        require(cliff <= duration, "Cliff must be <= duration");
        require(amount > 0, "Amount must be > 0");

        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: amount,
            released: 0, // trach total tokens the user has already withdrawn
            start: start,
            cliff: start + cliff,
            duration: duration,
            revoked: false
        });
        isVesting[beneficiary] = true;
        _transfer(msg.sender, address(this), amount); // Lock tokens in the contract instead of sending to beneficiary
    }

    function release() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(block.timestamp >= schedule.cliff, "Cliff period not ended");
        require(!schedule.revoked, "Vesting revoked");

        uint256 vested = _vestedAmount(msg.sender);
        uint256 unreleased = vested - schedule.released; // total tokens user can still calm
        require(unreleased > 0, "No tokens to release");

        schedule.released += unreleased;
        _transfer(address(this), msg.sender, unreleased); // Release tokens from contract
        emit TokensReleased(msg.sender, unreleased);
    }

    function _vestedAmount(address beneficiary) private view returns (uint256) { // calculates the total tokens the user is eligible to claim, return total vested amount, whether claimed or unclaimed
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (block.timestamp < schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        } else {
            return (schedule.totalAmount * (block.timestamp - schedule.start)) / schedule.duration;
        }
    }

    function revoke(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(!schedule.revoked, "Already revoked");
        schedule.revoked = true;
        emit VestingRevoked(beneficiary);
    }

    function burn(uint256 amount) external {
        _transfer(msg.sender, BURN_ADDRESS, amount);
    }

    function transfer(address recipient, uint256 amount) public override returns (bool) {
        if (isVesting[msg.sender]) {
            VestingSchedule storage schedule = vestingSchedules[msg.sender];
            require(block.timestamp >= schedule.cliff, "Cannot transfer during cliff period");
            uint256 unlocked = _vestedAmount(msg.sender) - schedule.released;
            require(amount <= unlocked, "Cannot transfer locked tokens");
        }
        return super.transfer(recipient, amount);
    }

    function getVestingDetails(address beneficiary) external view returns (uint256 granted, uint256 locked, uint256 unlocked) {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        uint256 vested = _vestedAmount(beneficiary);
        return (schedule.totalAmount, schedule.totalAmount - vested, vested - schedule.released);
    }
}
