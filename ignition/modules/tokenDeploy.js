const hre = require('hardhat')

async function main() {
    const TokenContract = await hre.ethers.getContractFactory('ERC20Token')
    const tokenContract = await TokenContract.deploy('MyToken', 'MTK', 18)

    await tokenContract.waitForDeployment()
    const tokenContractAddress = await tokenContract.getAddress();
    console.log(`Contract deployed to: ${tokenContractAddress}`);
    console.log("Contract deployed at:", tokenContract.target);
    await tokenContract.deploymentTransaction().wait(5);
    console.log("Now you can verify your contract!");
    
}

main().catch((err) => {
    console.log(err);
})