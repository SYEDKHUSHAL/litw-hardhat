import * as dotenv from "dotenv";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-contract-sizer";
import "hardhat-deploy";

dotenv.config();

const config = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 3333,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: 0,
    proxyOwner: 0,
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    token: "ETH",
    currency: "USD",
    coinmarketcap: "3ce4716d-ac46-4ead-887c-1cb53b707769",
    gasPriceApi:
      "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
    showTimeSpent: true,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
  },
  contractSizer: {
    runOnCompile: true,
  },
};

export default config;
