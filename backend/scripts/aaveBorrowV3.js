const { ethers, getNamedAccounts, network } = require("hardhat");
const { getWeth, AMOUNT } = require("../scripts/getWeth.js");
const { networkConfig } = require("../helper-hardhat-config");

async function main() {
  await getWeth();
  const { deployer } = await getNamedAccounts(); //deployer is an address
  const signer = await ethers.getSigner(deployer); //signer is not just an address
  const lendingPool = await getLendingPool(signer);
  const wethTokenAddress = networkConfig[network.config.chainId].wethToken;
  await approveErc20(wethTokenAddress, lendingPool.address, AMOUNT, signer);
  console.log("Depositing WETH...");
  await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0); //referralCode: 0
  console.log("Desposited!");
  // Getting your borrowing stats
  let { availableBorrowsBase, totalDebtBase } = await getBorrowUserData(
    lendingPool,
    deployer
  );
  const daiPrice = await getDaiPrice();
  const amountDaiToBorrow =
    (availableBorrowsBase.toString() * 0.95) / daiPrice.toNumber();
  const amountDaiToBorrowWei = ethers.utils.parseEther(
    amountDaiToBorrow.toString()
  );
  console.log("aa", amountDaiToBorrowWei);
  console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI`);
  await borrowDai(
    networkConfig[network.config.chainId].daiToken,
    lendingPool,
    amountDaiToBorrowWei,
    deployer
  );
  await getBorrowUserData(lendingPool, deployer);
  await repay(
    amountDaiToBorrowWei,
    networkConfig[network.config.chainId].daiToken,
    lendingPool,
    signer
  );
  await getBorrowUserData(lendingPool, deployer);
}

async function repay(amount, daiAddress, lendingPool, account) {
  await approveErc20(daiAddress, lendingPool.address, amount, account);
  const repayTx = await lendingPool.repay(
    daiAddress,
    amount,
    1,
    account.address
  );
  await repayTx.wait(1);
  console.log("Repaid!");
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
  const borrowTx = await lendingPool.borrow(
    daiAddress,
    amountDaiToBorrow,
    1,
    0,
    account
  );
  await borrowTx.wait(1);
  console.log("You've borrowed!");
}

async function getDaiPrice() {
  const daiEthPriceFeed = await ethers.getContractAt(
    "AggregatorV3Interface",
    networkConfig[network.config.chainId].daiEthPriceFeed
  );
  const price = (await daiEthPriceFeed.latestRoundData())[1];
  console.log(`The DAI/ETH price is ${price.toString()}`);
  return price;
}

async function approveErc20(erc20Address, spenderAddress, amount, signer) {
  const erc20Token = await ethers.getContractAt("IERC20", erc20Address, signer);
  txResponse = await erc20Token.approve(spenderAddress, amount);
  await txResponse.wait(1);
  console.log("Approved!");
}

async function getLendingPool(account) {
  const PoolAddressesProvider = await ethers.getContractAt(
    //"ILendingPoolAddressesProvider",
    "IPoolAddressesProvider",
    //networkConfig[network.config.chainId].lendingPoolAddressesProvider,
    networkConfig[network.config.chainId].PoolAddressesProvider,
    account
  );
  //   const lendingPoolAddress =
  //     await lendingPoolAddressesProvider.getLendingPool();
  const lendingPoolAddress = await PoolAddressesProvider.getPool();
  const lendingPool = await ethers.getContractAt(
    "IPool",
    lendingPoolAddress,
    account
  );
  return lendingPool;
}

async function getBorrowUserData(lendingPool, account) {
  const { totalCollateralBase, totalDebtBase, availableBorrowsBase } =
    await lendingPool.getUserAccountData(account);
  console.log(`You have ${totalCollateralBase} worth of ETH deposited.`);
  console.log(`You have ${totalDebtBase} worth of ETH borrowed.`);
  console.log(`You can borrow ${availableBorrowsBase} worth of ETH.`);
  return { availableBorrowsBase, totalDebtBase };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
