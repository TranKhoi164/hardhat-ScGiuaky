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
        bool paused;
        bool revoked;
    }
    // address private owner;

    mapping(address => VestingSchedule) public vestingSchedules;
    mapping(address => bool) public isVesting;
    // commonly used as official burn address
    address public constant BURN_ADDRESS =
        0x000000000000000000000000000000000000dEaD;

    event TokensReleased(address indexed beneficiary, uint256 amount);
    event VestingRevoked(address indexed beneficiary);
    event PauseVesting(address indexed beneficiary);
    event ResumeVesting(address indexed beneficiary);
    event BeneficiaryChanged(
        address indexed oldBeneficiary,
        address indexed newBeneficiary
    );

    constructor() ERC20("VestingToken", "VEST") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 1e18);
        // owner = msg.sender;
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
            paused: false,
            revoked: false
        });
        isVesting[beneficiary] = true;
        // msg.sender is owner
        _transfer(msg.sender, address(this), amount); // Lock tokens in the contract instead of sending to beneficiary
    }

    function release() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        require(block.timestamp >= schedule.cliff, "Cliff period not ended");
        require(!schedule.paused, "Vesting paused");
        require(!schedule.revoked, "Vesting revoked");

        uint256 vested = _vestedAmount(msg.sender);
        uint256 unreleased = vested - schedule.released; // total tokens user can still claim
        require(unreleased > 0, "No tokens to release");

        schedule.released += unreleased;
        _transfer(address(this), msg.sender, unreleased); // Release tokens from contract
        emit TokensReleased(msg.sender, unreleased);
    }

    function _vestedAmount(address beneficiary) private view returns (uint256) {
        // calculates the total tokens the user is eligible to claim, return total vested amount, whether claimed or unclaimed
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        if (block.timestamp < schedule.cliff) {
            return 0;
        } else if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.totalAmount;
        } else {
            return
                (schedule.totalAmount * (block.timestamp - schedule.start)) /
                schedule.duration;
        }
    }

    function pauseVesting(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(!schedule.paused, "Already paused");
        schedule.paused = true;
        emit PauseVesting(beneficiary);
    }

    function resumeVesting(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.paused, "Vesting is not paused");
        schedule.paused = false;
        emit ResumeVesting(beneficiary);
    }

    function revoke(address beneficiary) external onlyOwner {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(!schedule.revoked, "Already revoked");
        schedule.revoked = true;

        uint256 unreleasedTokens = schedule.totalAmount - schedule.released;
        _transfer(address(this), owner(), unreleasedTokens);

        emit VestingRevoked(beneficiary);
    }

    function burn(uint256 amount) external {
        _transfer(msg.sender, BURN_ADDRESS, amount);
    }

    function transfer(
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        if (isVesting[msg.sender]) {
            VestingSchedule storage schedule = vestingSchedules[msg.sender];
            require(
                block.timestamp >= schedule.cliff,
                "Cannot transfer during cliff period"
            );
            require(!schedule.paused, "Vesting paused");
            require(
                amount <= schedule.released,
                "Cannot transfer unreleased/locked tokens"
            );
        }
        return super.transfer(recipient, amount);
    }

    function getVestingDetails(
        address beneficiary
    )
        external
        view
        returns (uint256 granted, uint256 locked, uint256 unlocked)
    {
        VestingSchedule memory schedule = vestingSchedules[beneficiary];
        uint256 vested = _vestedAmount(beneficiary);
        return (
            schedule.totalAmount,
            schedule.totalAmount - vested,
            schedule.released
        );
    }

    function getVestingSchedule(
        address beneficiary
    )
        external
        view
        returns (
            VestingSchedule memory
        )
    {
        require(isVesting[beneficiary], "No vesting schedule found");

        VestingSchedule memory schedule = vestingSchedules[beneficiary];

        return schedule;
    }

    // only transfers the vesting schedule, not already released tokens
    function changeBeneficiary(
        address oldBeneficiary,
        address newBeneficiary
    ) external onlyOwner {
        require(
            isVesting[oldBeneficiary],
            "No vesting schedule found for old beneficiary"
        );
        require(
            oldBeneficiary != newBeneficiary,
            "New beneficiary must be different"
        );
        require(
            !isVesting[newBeneficiary],
            "New beneficiary already has a vesting schedule"
        );

        // Copy vesting schedule to new beneficiary
        vestingSchedules[newBeneficiary] = vestingSchedules[oldBeneficiary];

        // Remove vesting schedule from old beneficiary
        delete vestingSchedules[oldBeneficiary];
        isVesting[oldBeneficiary] = false;
        isVesting[newBeneficiary] = true;

        emit BeneficiaryChanged(oldBeneficiary, newBeneficiary);
    }
}
