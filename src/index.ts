require('dotenv').config();
import { JSONFile, Low } from '@commonify/lowdb';

import { Address, createPublicClient, encodeFunctionData, Hex, http, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createSmartAccountClient, ENTRYPOINT_ADDRESS_V06 } from 'permissionless';
import { privateKeyToSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoPaymasterClient } from 'permissionless/clients/pimlico';
import nftContractAbi from './abis/NFTContract.json';

const RPC_URL = process.env.COINBASE_BUNDLER_URL;
const publicClient = createPublicClient({
  transport: http(RPC_URL),
});
const chain = baseSepolia;

// Build a Smart Account with a Coinbase Paymaster
const initUser = async () => {
  const cache = new Low<{ scwAddress: Hex; address: Hex; pk: Hex }>(new JSONFile(`${process.cwd()}/.cache.json`));
  await cache.read();

  const privKeyHex = cache.data?.pk ?? (generatePrivateKey() as Hex);

  // Generate EOA from private key using ethers.js
  const owner = privateKeyToAccount(privKeyHex);

  // Create Smart Account instance
  const smartAccount = await privateKeyToSimpleSmartAccount(publicClient, {
    privateKey: privKeyHex, // Set this to your private key
    factoryAddress: '0x9406Cc6185a346906296840746125a0E44976454', // Fixed
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });

  // Create Coinbase Developer Platform Paymaster and plug it into the smart account client.
  const cloudPaymaster = createPimlicoPaymasterClient({
    chain: chain,
    transport: http(RPC_URL),
    entryPoint: ENTRYPOINT_ADDRESS_V06,
  });
  const smartWallet = createSmartAccountClient({
    account: smartAccount,
    chain: chain,
    bundlerTransport: http(RPC_URL),
    // IMPORTANT: Set up Cloud Paymaster to sponsor your transaction
    middleware: {
      sponsorUserOperation: cloudPaymaster.sponsorUserOperation as any,
    },
  });

  if (!cache.data) {
    cache.data = {
      scwAddress: smartWallet.account.address,
      address: owner.address,
      pk: privKeyHex,
    };
    await cache.write();
  }
  console.log('Init User:', { owner: owner.address, smartWallet: smartWallet.account.address });

  return { owner, smartWallet };
};

/**
 * Send ETH from Smart Account to another address
 * Requires the Smart Account to have enough ETH balance
 */
const buildSendETHTransaction = (ethReceiver: Address, ethValue = parseEther('0.0001')) => {
  console.log('Send ETH:', ethReceiver, ethValue);
  return {
    to: ethReceiver,
    data: '0x',
    value: ethValue,
  };
};

/**
 * Send Token from Smart Account to another address
 * Requires the Smart Account to have enough Token balance
 */
const buildSendTokenTransaction = (tokenReceiver: Address) => {
  // Claim some ETH Faucet to owner
  // Public mint some DAI to owner (0.001 ETH = 100 DAI)
  // Send 1 DAI to SmartAccountClient address
  const token: Address = '0x7683022d84F726a96c4A6611cD31DBf5409c0Ac9'; // Base Sepolia DAI
  console.log('Send Token:', token, tokenReceiver);
  // @ts-ignore
  const data = encodeFunctionData({
    abi: JSON.parse(
      '[{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]',
    ),
    functionName: 'transfer',
    args: [tokenReceiver, parseEther('1')],
  });
  return {
    to: token,
    data: data,
  };
};

/**
 * Mint NFT to another address
 */
const buildMintNFTTransaction = (nftReceiver: Address) => {
  console.log('Mint NFT:', nftReceiver);

  const NFT_CONTRACT_ADDRESS = process.env.SEPOLIA_NFT_ADDRESS as `0x${string}`;
  // @ts-ignore
  const data = encodeFunctionData({
    abi: nftContractAbi,
    functionName: 'mint',
    args: [nftReceiver],
  });
  return {
    to: NFT_CONTRACT_ADDRESS,
    data: data,
  };
};

// https://docs.cdp.coinbase.com/base-node/docs/paymaster-bundler-qs
const aaSendContract = async (smartWallet: any, to: Address) => {
  console.log('Smart Account: send a Smart Contract transaction');
  try {
    // const tx = buildMintNFTTransaction(to);
    const tx = buildSendTokenTransaction(to);
    // const tx = buildSendETHTransaction(to);
    console.log('Transaction data', tx);

    const txHash = await smartWallet.sendTransaction({
      account: smartWallet.account,
      ...tx,
    });

    console.log('✅ Transaction successfully sponsored!');
    console.log(`🔍 View on Etherscan: https://sepolia.basescan.org/tx/${txHash}`);
  } catch (e) {
    console.error('aaSendContract:', e.message);
  }
};

const processScript = async () => {
  const { owner, smartWallet } = await initUser();

  /// Sponsor by ETH
  await aaSendContract(smartWallet, owner.address);
  // Send ETH: https://sepolia.basescan.org/tx/0x9ca30112c8da4a72d08a4f7dfe2a0463e4929334c4e403f8adad0c71fbc42c2f
  // Send DAI ERC20 Token: https://sepolia.basescan.org/tx/0x7859000ebc3220b620934135795a76336813ca4bfe9eb67c8eda2d1bf9304d54
  // Mint NFT: https://sepolia.basescan.org/tx/0x300cbb3b4ff03def27cac0535229bae02d7f08ed150a5fc6fb2ec7ebc7d4150f
};

processScript()
  .then(() => {
    console.log('DONE');
    process.exit(0);
  })
  .catch((error) => console.error(error));
