const { expect } = require("chai");
require("@nomicfoundation/hardhat-chai-matchers");
const { ethers } = require("hardhat");

describe("VestingToken", function () {
	let VestingToken, vestingToken, owner, privateSale, publicSale;
	const totalSupply = ethers.parseEther("1000000");

	beforeEach(async function () {
		[owner, investor, privateSale, publicSale] = await ethers.getSigners();
		VestingToken = await ethers.getContractFactory("VestingToken");
		vestingToken = await VestingToken.deploy();
		await vestingToken.waitForDeployment();
	});

	it("test deploy with total supply", async function () {
		expect(await vestingToken.totalSupply()).to.equal(totalSupply);
		expect(await vestingToken.balanceOf(owner.address)).to.equal(totalSupply);
	});

	it("test only owner can call setVesting", async function () {
		const amount = totalSupply;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60; // 1 week
		const duration = 30 * 24 * 60 * 60; // 1 month

		await expect(
			vestingToken
				.connect(owner)
				.setVesting(investor.address, amount, start, cliff, duration)
		).to.not.be.reverted;

		await expect(
			vestingToken
				.connect(investor)
				.setVesting(publicSale.address, amount, start, cliff, duration)
		).to.be.reverted;
	});

	it("test owner can setVesting for many addresses", async function () {
		const investorAmount = (totalSupply * 40n) / 100n;
		const privateAmount = (totalSupply * 30n) / 100n;
		const publicAmount = (totalSupply * 30n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const investorCliff = 60 * 60 * 24 * 7;
		const investorDuration = 60 * 60 * 24 * 30;
		const privateCliff = 60 * 60 * 24 * 3;
		const privateDuration = 60 * 60 * 24 * 7;
		const publicCliff = 60 * 60 * 24 * 3;
		const pubilcDuration = 60 * 60 * 24 * 7;

		await vestingToken.setVesting(
			investor.address,
			investorAmount,
			start,
			investorCliff,
			investorDuration
		);
		await vestingToken.setVesting(
			privateSale.address,
			privateAmount,
			start,
			privateCliff,
			privateDuration
		);
		await vestingToken.setVesting(
			publicSale.address,
			publicAmount,
			start,
			publicCliff,
			pubilcDuration
		);
		const investorVestingDetail = await vestingToken.getVestingDetails(
			investor.address
		);
		const privateSaleVestingDetail = await vestingToken.getVestingDetails(
			privateSale.address
		);
		const publicSaleVestingDetail = await vestingToken.getVestingDetails(
			publicSale.address
		);

		expect(investorVestingDetail[0]).to.equal(investorAmount);
		expect(privateSaleVestingDetail[0]).to.equal(privateAmount);
		expect(publicSaleVestingDetail[0]).to.equal(publicAmount);
	});
	it("test prevent user from releasing tokens before cliff", async function () {
		const investorAmount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const investorCliff = 7 * 24 * 60 * 60; // 1 week
		const investorDuration = 30 * 24 * 60 * 60; // 1 month

		await vestingToken.setVesting(
			investor.address,
			investorAmount,
			start,
			investorCliff,
			investorDuration
		);

		await expect(vestingToken.connect(investor).release()).to.be.revertedWith(
			"Cliff period not ended"
		);
	});

	it("test allow user to release vested tokens after cliff", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [cliff]);
		// await ethers.provider.send("evm_mine");

		await expect(vestingToken.connect(investor).release()).to.emit(
			vestingToken,
			"TokensReleased"
		);
	});

	it("test balance of user equals to granted amount after full vesting duration", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [duration]);
		// await ethers.provider.send("evm_mine");
		await vestingToken.connect(investor).release();

		const finalBalance = await vestingToken.balanceOf(investor.address);

		expect(finalBalance).to.equal(amount);
	});
	it("test prevent user from transferring before cliff", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await expect(
			vestingToken
				.connect(investor)
				.transfer(publicSale.address, ethers.parseEther("10"))
		).to.be.revertedWith("Cannot transfer during cliff period");
	});
	it("test prevent user from transferring locked tokens", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [cliff]);
		await vestingToken.connect(investor).release();
		await ethers.provider.send("evm_increaseTime", [duration]);
		// await ethers.provider.send("evm_mine");

		await expect(
			vestingToken
				.connect(investor)
				.transfer(publicSale.address, (totalSupply * 40n) / 100n)
		).to.be.revertedWith("Cannot transfer unreleased/locked tokens");
	});

	it("test allow user to transfer only unlocked tokens", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [cliff + duration / 2]);
		// await ethers.provider.send("evm_mine");

		await vestingToken.connect(investor).release();
		const unlocked = (
			await vestingToken.getVestingDetails(investor.address)
		)[2];
		await expect(
			vestingToken.connect(investor).transfer(publicSale.address, unlocked)
		).to.not.be.reverted;
	});

	it("test prevent user from releasing/transfering if vesting are paused", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [duration]);

		await expect(vestingToken.pauseVesting(investor.address)).to.be.emit(
			vestingToken,
			"PauseVesting"
		);
		// await vestingToken.pauseVesting(investor.address)

		await expect(vestingToken.connect(investor).release()).to.be.revertedWith(
			"Vesting paused"
		);
		await expect(
			vestingToken.connect(investor).transfer(publicSale, amount)
		).to.be.revertedWith("Vesting paused");
	});

	it("test allow user to release/transfer if vesting are resumed", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [cliff]);

		await expect(vestingToken.pauseVesting(investor.address)).to.be.emit(
			vestingToken,
			"PauseVesting"
		);
		// await vestingToken.pauseVesting(investor.address)

		await expect(vestingToken.connect(investor).release()).to.be.revertedWith(
			"Vesting paused"
		);
		await expect(vestingToken.resumeVesting(investor.address)).to.be.emit(
			vestingToken,
			"ResumeVesting"
		);
		await expect(vestingToken.connect(investor).release()).to.not.be.reverted;
		await expect(
			vestingToken
				.connect(investor)
				.transfer(publicSale, (amount * BigInt(cliff)) / BigInt(duration))
		).to.not.be.reverted;
	});

	it("test revoke function", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);
		await ethers.provider.send("evm_increaseTime", [cliff]);
		// test can call revoke function
		await expect(vestingToken.revoke(investor.address)).to.be.emit(
			vestingToken,
			"VestingRevoked"
		);
		// test cant release tokens after revoked
		await expect(vestingToken.connect(investor).release()).to.be.revertedWith(
			"Vesting revoked"
		);
		// test tokens returned to owner after revoked
		expect(await vestingToken.balanceOf(owner.address)).to.equal(totalSupply);
	});

	it("test getVestingSchedule", async function () {
		const amount = (totalSupply * 40n) / 100n;
		const latestBlock = await ethers.provider.getBlock("latest");
		const start = latestBlock
			? latestBlock.timestamp
			: Math.floor(Date.now() / 1000);
		const cliff = 7 * 24 * 60 * 60;
		const duration = 30 * 24 * 60 * 60;

		await vestingToken.setVesting(
			investor.address,
			amount,
			start,
			cliff,
			duration
		);

		const vestingSchedule = await vestingToken.getVestingSchedule(
			investor.address
		);

		expect(vestingSchedule.totalAmount).to.equal(amount);
		expect(vestingSchedule.start).to.equal(start);
		expect(vestingSchedule.cliff).to.equal(start + cliff);
		expect(vestingSchedule.duration).to.equal(duration);
		expect(vestingSchedule.paused).to.equal(false);
		expect(vestingSchedule.revoked).to.equal(false);
	});

  it('test getVestingSchedule reverted if beneficiary is non-existent', async function() {
    await expect(vestingToken.getVestingSchedule(investor.address)).to.be.revertedWith('No vesting schedule found')
  })

	it("test burn tokens correctly", async function () {
		const burnAmount = ethers.parseEther("50");
		await vestingToken.burn(burnAmount);

		expect(await vestingToken.balanceOf(vestingToken.BURN_ADDRESS())).to.equal(
			burnAmount
		);
	});
});

describe("VestingToken - changeBeneficiary", function () {
	let VestingToken, vestingToken, owner, oldBeneficiary, newBeneficiary;
	const totalSupply = ethers.parseEther("1000000");

	let amount;
	let start;
	let cliff;
	let duration;

	beforeEach(async function () {
		[owner, oldBeneficiary, newBeneficiary] = await ethers.getSigners();
		// Deploy contract
		VestingToken = await ethers.getContractFactory("VestingToken");
		vestingToken = await VestingToken.deploy();
		await vestingToken.waitForDeployment();

		// Set vesting schedule for old beneficiary
		amount = ethers.parseEther("1000"); // 1000 tokens
		start = (await ethers.provider.getBlock("latest")).timestamp;
		cliff = 60 * 60 * 24 * 30; // 30 days
		duration = 60 * 60 * 24 * 365; // 1 year

		await vestingToken
			.connect(owner)
			.setVesting(oldBeneficiary.address, amount, start, cliff, duration);
	});

	it("test transfer vesting schedule to new beneficiary", async function () {
		// Change beneficiary
		await vestingToken
			.connect(owner)
			.changeBeneficiary(oldBeneficiary.address, newBeneficiary.address);

		// Check vesting schedule exists for new beneficiary
		const newSchedule = await vestingToken.getVestingSchedule(
			newBeneficiary.address
		);
		expect(newSchedule.totalAmount).to.equal(ethers.parseEther("1000"));

		// Old beneficiary should no longer have a vesting schedule
		await expect(
			vestingToken.getVestingSchedule(oldBeneficiary.address)
		).to.be.revertedWith("No vesting schedule found");
	});

	it("test revert if old beneficiary has no vesting schedule", async function () {
		await expect(
			vestingToken
				.connect(owner)
				.changeBeneficiary(newBeneficiary.address, oldBeneficiary.address)
		).to.be.revertedWith("No vesting schedule found for old beneficiary");
	});

	it("test revert if new beneficiary already has a vesting schedule", async function () {
		const amount = ethers.parseEther("500"); // 500 tokens
		const start = (await ethers.provider.getBlock("latest")).timestamp;
		const cliff = 60 * 60 * 24 * 15; // 15 days
		const duration = 60 * 60 * 24 * 180; // 6 months

		// Set vesting for newBeneficiary to create a conflict
		await vestingToken
			.connect(owner)
			.setVesting(newBeneficiary.address, amount, start, cliff, duration);

		await expect(
			vestingToken
				.connect(owner)
				.changeBeneficiary(oldBeneficiary.address, newBeneficiary.address)
		).to.be.revertedWith("New beneficiary already has a vesting schedule");
	});

	it("test emit BeneficiaryChanged event", async function () {
		await expect(
			vestingToken
				.connect(owner)
				.changeBeneficiary(oldBeneficiary.address, newBeneficiary.address)
		)
			.to.emit(vestingToken, "BeneficiaryChanged")
			.withArgs(oldBeneficiary.address, newBeneficiary.address);
	});

	it("test allow new beneficiary to release after changeBeneficiary", async function () {
		await ethers.provider.send("evm_increaseTime", [cliff]);

		// Old beneficiary releases vested tokens
		await vestingToken.connect(oldBeneficiary).release();

		// Change beneficiary
		await vestingToken
			.connect(owner)
			.changeBeneficiary(oldBeneficiary.address, newBeneficiary.address);

		await vestingToken.connect(newBeneficiary).release();
		expect(await vestingToken.balanceOf(newBeneficiary.address)).not.to.equal(
			0
		);
	});
});
