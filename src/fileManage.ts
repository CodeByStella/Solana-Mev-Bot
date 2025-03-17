import chalk from "chalk";
import * as fs from "fs";

export function loadWalletFile(filePath: string) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (!parsed.address || !parsed.privateKey) {
            console.log(chalk.red(`Wallet file '${filePath}' is corrupted or invalid.`));
            return null;
        }
        return parsed;
    } catch (error) {
        console.log(chalk.red(`Error loading wallet from '${filePath}':`), error);
        return null;
    }
}