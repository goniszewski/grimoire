import chalk from 'chalk';

export function createPerformanceLogs(logs: [string, number | string, string?][]): string {
	const maxLabelLength = Math.max(...logs.map(([label]) => label.length));
	return logs
		.map(([label, time, suffix]) => {
			const formattedLabel = label.padEnd(maxLabelLength + 3);
			const formattedValue = chalk.yellow(typeof time === 'number' ? time.toFixed(2) : time);
			return `${formattedLabel}${formattedValue}${suffix ? ` ${chalk.gray(suffix)}` : ''}`;
		})
		.join('\n');
}
