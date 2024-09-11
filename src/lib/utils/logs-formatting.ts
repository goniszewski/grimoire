import chalk from 'chalk';

export function createPerformanceLogs(logs: [string, number][]) {
	const maxLabelLength = Math.max(...logs.map(([label]) => label.length));
	return logs
		.map(([label, time]) => {
			const formattedLabel = label.padEnd(maxLabelLength + 3);
			const formattedValue = chalk.yellow(time.toFixed(2) + 'ms');
			return `${formattedLabel}${formattedValue}`;
		})
		.join('\n');
}
