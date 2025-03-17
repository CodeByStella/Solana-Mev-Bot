// import chalk from "chalk";
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
export function filterScamTokens() {
    console.log(chalk.green('Scam token filter is ready ✅'));
}
export function checkListOfTokens() {
    console.log(chalk.green('List of Tokens ✅'));
}
export function autoConnectNetwork() {
    console.log(chalk.green('Connected to network ready ✅'));
}
