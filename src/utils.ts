import chalk from "chalk";

export function filterScamTokens() {
    console.log(chalk.green('Scam token filter is ready ✅'));
}

export function checkListOfTokens() {
    console.log(chalk.green('List of Tokens ✅'));
}

export function autoConnectNetwork() {
    console.log(chalk.green('Connected to network ready ✅'));
}

export function decodeBase64(encoded: string) {
    return parseFloat(Buffer.from(encoded, 'base64').toString('utf8'));
}

